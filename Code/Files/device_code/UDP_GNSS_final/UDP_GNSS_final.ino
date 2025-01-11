#include <inttypes.h>
#include <esp_mac.h>
#include <esp_sleep.h>
#include <WalterModem.h>

/**
 * @brief The address of the server to upload the data to. 
 */
#define SERV_ADDR "xx.xxx.xxx.xxx"

/**
 * @brief The UDP port on which the server is listening.
 */
#define SERV_PORT 51234

/**
 * @brief The size in bytes of a minimal sensor + GNSS + cell info packet.
 */
#define PACKET_SIZE 29

/**
 * @brief Buffer for formatted message
 */
char formattedMessage[256];

/**
 * @brief All fixes with a confidence below this number are considered ok.
 */
#define MAX_GNSS_CONFIDENCE 150.0

#define MIN_SIGNAL_STRENGTH 25           // Lowered minimum signal strength

/**
 * @brief The serial interface to talk to the modem.
 */
#define ModemSerial Serial2

/**
 * @brief The radio access technology to use - LTEM or NBIOT.
 */
#define RADIO_TECHNOLOGY WALTER_MODEM_RAT_LTEM

/**
 * @brief Button pin and timing constants
 */
#define BUTTON_PIN 4  // Connect button between GPIO 4 and GND
#define uS_TO_S_FACTOR 1000000ULL  // Conversion factor for micro seconds to seconds
#define TIME_TO_SLEEP (12 * 60 * 60)  // 12 hours in seconds
#define BUTTON_TIMEOUT (5 * 60 * 1000) // 5 minutes in milliseconds

/**
 * @brief Boot count and button timing stored in RTC memory
 */
RTC_DATA_ATTR int bootCount = 0;
RTC_DATA_ATTR uint64_t lastButtonPress = 0;

/**
 * @brief The modem instance.
 */
WalterModem modem;

/**
 * @brief Print wake up reason for debugging
 */
void print_wakeup_reason() {
  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();

  switch(wakeup_reason) {
    case ESP_SLEEP_WAKEUP_EXT0:
      Serial.println("Wakeup caused by button press!");
      break;
    case ESP_SLEEP_WAKEUP_TIMER:
      Serial.println("Wakeup caused by timer");
      break;
    default:
      Serial.println("Wakeup was not caused by deep sleep");
      break;
  }
}

/**
 * @brief Flag used to signal when a fix is received.
 */
volatile bool fixRcvd = false;

/**
 * @brief The last received GNSS fix.
 */
WalterModemGNSSFix posFix = {};

/**
 * @brief The buffer to transmit to the UDP server. The first 6 bytes will be
 * the MAC address of the Walter this code is running on.
 */
uint8_t dataBuf[PACKET_SIZE] = { 0 };

/**
 * @brief Connect to the LTE network.
 * 
 * This function will connect the modem to the LTE network. This function will
 * block until the modem is attached.
 * 
 * @return True on success, false on error.
 */
bool lteConnect()
{
  /* Set the operational state to full */
  if(!modem.setOpState(WALTER_MODEM_OPSTATE_FULL)) {
    Serial.print("Could not set operational state to FULL\r\n");
    return false;
  }

  /* Set the network operator selection to automatic */
  if(!modem.setNetworkSelectionMode(WALTER_MODEM_NETWORK_SEL_MODE_AUTOMATIC)) {
    Serial.print("Could not set the network selection mode to automatic\r\n");
    return false;
  }

  /* Wait for the network to become available */
  WalterModemNetworkRegState regState = modem.getNetworkRegState();
  while(!(regState == WALTER_MODEM_NETWORK_REG_REGISTERED_HOME ||
          regState == WALTER_MODEM_NETWORK_REG_REGISTERED_ROAMING))
  {
    delay(100);
    regState = modem.getNetworkRegState();
  }

  /* Stabilization time */
  Serial.print("Connected to the network\r\n");
  return true;
}

/**
 * @brief Disconnect from the LTE network.
 * 
 * This function will disconnect the modem from the LTE network and block until
 * the network is actually disconnected. After the network is disconnected the
 * GNSS subsystem can be used.
 * 
 * @return True on success, false on error.
 */
bool lteDisconnect()
{
  /* Set the operational state to minimum */
  if(!modem.setOpState(WALTER_MODEM_OPSTATE_MINIMUM)) {
    Serial.print("Could not set operational state to MINIMUM\r\n");
    return false;
  }

  /* Wait for the network to become available */
  WalterModemNetworkRegState regState = modem.getNetworkRegState();
  while(regState != WALTER_MODEM_NETWORK_REG_NOT_SEARCHING)
  {
    delay(100);
    regState = modem.getNetworkRegState();
  }

  Serial.print("Disconnected from the network\r\n");
  return true;
}

/**
 * @brief Check the assistance data in the modem response.
 * 
 * This function checks the availability of assistance data in the modem's 
 * response. This function also sets a flag if any of the assistance databases
 * should be updated.
 * 
 * @param rsp The modem response to check.
 * @param updateAlmanac Pointer to the flag to set when the almanac should be
 * updated. 
 * @param updateEphemeris Pointer to the flag to set when ephemeris should be
 * updated.
 * 
 * @return None.
 */
void checkAssistanceData(
  WalterModemRsp *rsp,
  bool *updateAlmanac = NULL,
  bool *updateEphemeris = NULL)
{
  if(updateAlmanac != NULL) {
    *updateAlmanac = false;
  }

  if(updateEphemeris != NULL) {
    *updateEphemeris = false;
  }

  Serial.print("Almanac data is ");
  if(rsp->data.gnssAssistance.almanac.available) {
    Serial.printf("available and should be updated within %ds\r\n",
      rsp->data.gnssAssistance.almanac.timeToUpdate);
    if(updateAlmanac != NULL) {
      *updateAlmanac = rsp->data.gnssAssistance.almanac.timeToUpdate <= 0;
    }
  } else {
    Serial.print("not available.\r\n");
    if(updateAlmanac != NULL) {
      *updateAlmanac = true;
    }
  }

  Serial.print("Real-time ephemeris data is ");
  if(rsp->data.gnssAssistance.realtimeEphemeris.available) {
    Serial.printf("available and should be updated within %ds\r\n",
      rsp->data.gnssAssistance.realtimeEphemeris.timeToUpdate);
    if(updateEphemeris != NULL) {
      *updateEphemeris = rsp->data.gnssAssistance.realtimeEphemeris.timeToUpdate <= 0;
    }
  } else {
    Serial.print("not available.\r\n");
    if(updateEphemeris != NULL) {
      *updateEphemeris = true;
    }
  }
}

/**
 * @brief This function will update GNSS assistance data when needed.
 * 
 * This funtion will check if the current real-time ephemeris data is good
 * enough to get a fast GNSS fix. If not the function will attach to the LTE 
 * network to download newer assistance data.
 * 
 * @return True on success, false on error.
 */
bool updateGNSSAssistance()
{
  bool lteConnected = false;
  WalterModemRsp rsp = {};

  lteDisconnect();

  /* Even with valid assistance data the system clock could be invalid */
  if(!modem.getClock(&rsp)) {
    Serial.print("Could not check the modem time\r\n");
    return false;
  }

  if(rsp.data.clock <= 0) {
    /* The system clock is invalid, connect to LTE network to sync time */
    if(!lteConnect()) {
      Serial.print("Could not connect to LTE network\r\n");
      return false;
    }

    lteConnected = true;

    /* 
     * Wait for the modem to synchronize time with the LTE network, try 5 times
     * with a delay of 500ms.
     */
    for(int i = 0; i < 5; ++i) {
      if(!modem.getClock(&rsp)) {
        Serial.print("Could not check the modem time\r\n");
        return false;
      }

      if(rsp.data.clock > 0) {
        Serial.printf("Synchronized clock with network: %"PRIi64"\r\n",
          rsp.data.clock);
        break;
      } else if(i == 4) {
        Serial.print("Could not sync time with network\r\n");
        return false;
      }

      delay(500);
    }
  }

  /* Check the availability of assistance data */
  if(!modem.getGNSSAssistanceStatus(&rsp) ||
     rsp.type != WALTER_MODEM_RSP_DATA_TYPE_GNSS_ASSISTANCE_DATA)
  {
    Serial.print("Could not request GNSS assistance status\r\n");
    return false;
  }

  bool updateAlmanac = false;
  bool updateEphemeris = false;
  checkAssistanceData(&rsp, &updateAlmanac, &updateEphemeris);

  if(!(updateAlmanac || updateEphemeris)) {
    if(lteConnected) {
      if(!lteDisconnect()) {
        Serial.print("Could not disconnect from the LTE network\r\n");
        return false;
      }
    }

    return true;
  }

  if(!lteConnected) {
    if(!lteConnect()) {
      Serial.print("Could not connect to LTE network\r\n");
      return false;
    }
  }

  if(updateAlmanac) {
    if(!modem.updateGNSSAssistance(WALTER_MODEM_GNSS_ASSISTANCE_TYPE_ALMANAC)) {
      Serial.print("Could not update almanac data\r\n");
      return false;
    }
  }

  if(updateEphemeris) {
    if(!modem.updateGNSSAssistance(
      WALTER_MODEM_GNSS_ASSISTANCE_TYPE_REALTIME_EPHEMERIS))
    {
      Serial.print("Could not update real-time ephemeris data\r\n");
      return false;
    }
  }

  if(!modem.getGNSSAssistanceStatus(&rsp) ||
    rsp.type != WALTER_MODEM_RSP_DATA_TYPE_GNSS_ASSISTANCE_DATA)
  {
    Serial.print("Could not request GNSS assistance status\r\n");
    return false;
  }

  checkAssistanceData(&rsp);
  
  if(!lteDisconnect()) {
    Serial.print("Could not disconnect from the LTE network\r\n");
    return false;
  }

  return true;
}

/**
 * @brief Connect to an UDP socket.
 * 
 * This function will set-up the modem and connect an UDP socket. The LTE 
 * connection must be active before this function can be called.
 * 
 * @param ip The IP address of the server to connect to.
 * @param port The port to connect to.
 * 
 * @return True on success, false on error.
 */
bool socketConnect(const char *ip, uint16_t port)
{
  /* Construct a socket */
  if(!modem.createSocket()) {
    Serial.print("Could not create a new socket\r\n");
    return false;
  }

  /* Configure the socket */
  if(!modem.configSocket()) {
    Serial.print("Could not configure the socket\r\n");
    return false;
  }

  /* Connect to the UDP test server */
  if(modem.connectSocket(ip, port, port)) {
    Serial.printf("Connected to UDP server %s:%d\r\n", ip, port);
  } else {
    Serial.print("Could not connect UDP socket\r\n");
    return false;
  }

  return true;
}

/**
 * @brief This function is called when a fix attempt finished.
 * 
 * This function is called by Walter's modem library as soon as a fix attempt
 * has finished. This function should be handled as an interrupt and should be
 * as short as possible as it is called within the modem data thread.
 * 
 * @param fix The fix data.
 * @param args Optional arguments, a NULL pointer in this case.
 * 
 * @return None.
 */
void fixHandler(const WalterModemGNSSFix *fix, void *args)
{
  memcpy(&posFix, fix, sizeof(WalterModemGNSSFix));
  fixRcvd = true;
}

/**
 * @brief The size in bytes of a hello message packet.
 */
#define HELLO_PACKET_SIZE 64

/**
 * @brief Buffer for the hello message.
 */
char helloMessage[HELLO_PACKET_SIZE];

/**
 * @brief Send a hello message when the board starts up.
 * 
 * @return True on success, false on error.
 */
bool sendHelloMessage() {
  /* Format the hello message with MAC address */
  snprintf(helloMessage, HELLO_PACKET_SIZE, "Hello, I am %02X:%02X:%02X:%02X:%02X:%02X",
    dataBuf[0], dataBuf[1], dataBuf[2], 
    dataBuf[3], dataBuf[4], dataBuf[5]);

  /* Connect to LTE if not already connected */
  if(!lteConnect()) {
    Serial.print("Could not connect to the LTE network\r\n");
    return false;
  }

  /* Connect to UDP socket */
  if(!socketConnect(SERV_ADDR, SERV_PORT)) {
    Serial.print("Could not connect to UDP server socket\r\n");
    return false;
  }

  /* Send the hello message */
  if(!modem.socketSend((uint8_t*)helloMessage, strlen(helloMessage))) {
    Serial.print("Could not transmit hello message\r\n");
    return false;
  }

  Serial.printf("Sent hello message: %s\r\n", helloMessage);

  /* Close socket */
  if(!modem.closeSocket()) {
    Serial.print("Could not close the socket\r\n");
    return false;
  }
  return true;
}

/**
 * @brief Set up the system.
 * 
 * This function will set up the system and initialize the modem.
 * 
 * @return None.
 */

void setup()
{
  Serial.begin(115200);
  delay(5000);

  Serial.print("Walter Positioning v0.0.3\r\n");
  
  // Increment boot count and print wake up info
  bootCount++;
  Serial.println("Boot number: " + String(bootCount));
  print_wakeup_reason();

  // Configure button pin with internal pullup
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Serial.print("Current button state: ");
  Serial.println(digitalRead(BUTTON_PIN));

  /* Get the MAC address for board validation */
  esp_read_mac(dataBuf, ESP_MAC_WIFI_STA);
  Serial.printf("Walter's MAC is: %02X:%02X:%02X:%02X:%02X:%02X\r\n",
    dataBuf[0],
    dataBuf[1],
    dataBuf[2],
    dataBuf[3],
    dataBuf[4],
    dataBuf[5]);

  /* Modem initialization */
  if(modem.begin(&ModemSerial)) {
    Serial.print("Modem initialization OK\r\n");
  } else {
    Serial.print("Modem initialization ERROR\r\n");
    // Clean up power saving modes before restart
    modem.configPSM(WALTER_MODEM_PSM_DISABLE);
    modem.configEDRX(WALTER_MODEM_EDRX_DISABLE);
    delay(1000);
    ESP.restart();
    return;
  }

  WalterModemRsp rsp = {};
  if(modem.getIdentity(&rsp)) {
    Serial.print("Modem identity:\r\n");
    Serial.printf(" -IMEI: %s\r\n", rsp.data.identity.imei);
    Serial.printf(" -IMEISV: %s\r\n", rsp.data.identity.imeisv);
    Serial.printf(" -SVN: %s\r\n", rsp.data.identity.svn);
  }

  if(modem.getRAT(&rsp)) {
    if(rsp.data.rat != RADIO_TECHNOLOGY) {
      modem.setRAT(RADIO_TECHNOLOGY);
      Serial.println("Switched modem radio technology");
    }
  } else {
    Serial.println("Could not retrieve radio access technology");
  }

  if(!modem.createPDPContext("iot.truphone.com", WALTER_MODEM_PDP_AUTH_PROTO_PAP, "sora", "sora")) {
    Serial.println("Could not create PDP context");
    delay(1000);
    ESP.restart();
    return;
  }

  if(!modem.setOpState(WALTER_MODEM_OPSTATE_NO_RF)) {
    Serial.print("Could not set operational state to NO RF\r\n");
    delay(1000);
    ESP.restart();
    return;
  }

  delay(500);

  if(modem.getSIMCardID(&rsp)) {
    Serial.print("SIM card identity:\r\n");
    Serial.printf(" -ICCID: %s\r\n", rsp.data.simCardID.iccid);
    Serial.printf(" -eUICCID: %s\r\n", rsp.data.simCardID.euiccid);
  }

  if(modem.getSIMCardIMSI(&rsp)) {
    Serial.printf("Active IMSI: %s\r\n", rsp.data.imsi);
  }

  if(!sendHelloMessage()) {
    Serial.print("Failed to send hello message\r\n");
    delay(1000);
    ESP.restart();
    return;
  }

  if(!modem.configGNSS()) {
    Serial.print("Could not configure the GNSS subsystem\r\n");
    delay(1000);
    ESP.restart();
    return;
  }

  modem.setGNSSfixHandler(fixHandler);

  /* Check clock and assistance data, update if required */
  if(!updateGNSSAssistance()) {
    Serial.print("Could not update GNSS assistance data\r\n");
    delay(1000);
    ESP.restart();
    return;
  }

  /* Try up to 5 times to get a good fix */
  for(int i = 0; i < 5; ++i) {
    fixRcvd = false;
    if(!modem.performGNSSAction()) {
      Serial.print("Could not request GNSS fix\r\n");
      delay(1000);
      ESP.restart();
      return;
    }
    Serial.print("Started GNSS fix\r\n");

    int j = 0;
    while(!fixRcvd) {
        Serial.print(".");
        if (j >= 60) {
            Serial.println("");
            Serial.println("Timed out while waiting for GNSS fix");
            delay(1000);
            ESP.restart();
            break;
        }
        j++;
        delay(500);
    }
    
    Serial.println("");

    if(posFix.estimatedConfidence <= MAX_GNSS_CONFIDENCE) {
      break;
    }
  }

  uint8_t abovedBTreshold = 0;
  for(int i = 0; i < posFix.satCount; ++i) {
    if(posFix.sats[i].signalStrength >= 30) {
      abovedBTreshold += 1;
    }
  }

  Serial.printf("GNSS fix attempt finished:\r\n"
    "  Confidence: %.02f\r\n"
    "  Latitude: %.06f\r\n"
    "  Longitude: %.06f\r\n"
    "  Satcount: %d\r\n"
    "  Good sats: %d\r\n",
    posFix.estimatedConfidence,
    posFix.latitude,
    posFix.longitude,
    posFix.satCount,
    abovedBTreshold);

  float lat = posFix.latitude;
  float lon = posFix.longitude;
  
  if(posFix.estimatedConfidence > MAX_GNSS_CONFIDENCE) {
    posFix.satCount = 0xFF;
    lat = 0.0;
    lon = 0.0;
    Serial.print("Could not get a valid fix\r\n");
  }

  /* Construct the minimal sensor + GNSS */
  dataBuf[9] = posFix.satCount;
  memcpy(dataBuf + 10, &lat, 4);
  memcpy(dataBuf + 14, &lon, 4);

  /* Transmit the packet */
  if(!lteConnect()) {
    Serial.print("Could not connect to the LTE network\r\n");
    delay(1000);
    ESP.restart();
    return;
  }

  if(!modem.getCellInformation(WALTER_MODEM_SQNMONI_REPORTS_SERVING_CELL, &rsp)) {
    Serial.println("Could not request cell information");
  } else {
    Serial.printf("Connected on band %u using operator %s (%u%02u)",
      rsp.data.cellInformation.band, rsp.data.cellInformation.netName,
      rsp.data.cellInformation.cc, rsp.data.cellInformation.nc);
    Serial.printf(" and cell ID %u.\r\n",
      rsp.data.cellInformation.cid);
    Serial.printf("Signal strength: RSRP: %.2f, RSRQ: %.2f.\r\n",
      rsp.data.cellInformation.rsrp, rsp.data.cellInformation.rsrq);
  }

  dataBuf[18] = rsp.data.cellInformation.cc >> 8;
  dataBuf[19] = rsp.data.cellInformation.cc & 0xFF;
  dataBuf[20] = rsp.data.cellInformation.nc >> 8;
  dataBuf[21] = rsp.data.cellInformation.nc & 0xFF;
  dataBuf[22] = rsp.data.cellInformation.tac >> 8;
  dataBuf[23] = rsp.data.cellInformation.tac & 0xFF;
  dataBuf[24] = (rsp.data.cellInformation.cid >> 24) & 0xFF;
  dataBuf[25] = (rsp.data.cellInformation.cid >> 16) & 0xFF;
  dataBuf[26] = (rsp.data.cellInformation.cid >> 8) & 0xFF;
  dataBuf[27] = rsp.data.cellInformation.cid & 0xFF;
  dataBuf[28] = (uint8_t) (rsp.data.cellInformation.rsrp * -1);

  /* Format the data as JSON */
  snprintf(formattedMessage, sizeof(formattedMessage),
    "{"
    "\"mac\":\"%02X:%02X:%02X:%02X:%02X:%02X\","
    "\"satellites\":%d,"
    "\"confidence\":%.2f,"
    "\"latitude\":%.6f,"
    "\"longitude\":%.6f,"
    "\"cell_cc\":%u,"
    "\"cell_nc\":%u,"
    "\"cell_tac\":%u,"
    "\"cell_cid\":%u,"
    "\"cell_rsrp\":%.2f"
    "}",
    dataBuf[0], dataBuf[1], dataBuf[2], dataBuf[3], dataBuf[4], dataBuf[5],
    posFix.satCount,
    posFix.estimatedConfidence,
    lat, lon,
    rsp.data.cellInformation.cc,
    rsp.data.cellInformation.nc,
    rsp.data.cellInformation.tac,
    rsp.data.cellInformation.cid,
    rsp.data.cellInformation.rsrp
  );

  if(!socketConnect(SERV_ADDR, SERV_PORT)) {
    Serial.print("Could not connect to UDP server socket\r\n");
    delay(1000);
    ESP.restart();
    return;
  }

  if(!modem.socketSend((uint8_t*)formattedMessage, strlen(formattedMessage))) {
    Serial.print("Could not transmit data\r\n");
    delay(1000);
    ESP.restart();
    return;
  }
  delay(5000);

  if(!modem.closeSocket()) {
    Serial.print("Could not close the socket\r\n");
    delay(1000);
    ESP.restart();
    return;
  }

  lteDisconnect();

  // Check if button is currently pressed
  if (digitalRead(BUTTON_PIN) == LOW) {  // LOW means pressed due to pullup
    lastButtonPress = millis();
  }

  // Stay in a loop as long as button was pressed within last 5 minutes
  while ((millis() - lastButtonPress) < BUTTON_TIMEOUT) {
    if (digitalRead(BUTTON_PIN) == LOW) {  // Update last press time if button is pressed again
      lastButtonPress = millis();
      Serial.println("Button pressed, extending awake time");
    }
    delay(100);  // Small delay to prevent tight loop
  }

  // Configure wake up sources
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_4, LOW); // Wake on button press (LOW because of pullup)
  esp_sleep_enable_timer_wakeup(TIME_TO_SLEEP * uS_TO_S_FACTOR);
  
  Serial.println("No button press detected for 5 minutes");
  Serial.println("Going to sleep for 12 hours");
  Serial.println("(or press the button to wake)");
  Serial.flush();
  
  esp_deep_sleep_start();
}

void loop() {
  // This will never run as deep sleep restarts the ESP
}
