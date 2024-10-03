#define OTAA_PERIOD   (300000) 
#define OTAA_BAND     (RAK_REGION_EU868)
#define OTAA_DEVEUI   {0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx}
#define OTAA_APPEUI   {0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx}
#define OTAA_APPKEY   {0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx, 0xxx}
 
//init payload package
uint8_t payload[64] = {0};
 
void setup()
{
  Serial.begin(115200);
  uint8_t node_device_eui[8] = OTAA_DEVEUI;
  uint8_t node_app_eui[8] = OTAA_APPEUI;
  uint8_t node_app_key[16] = OTAA_APPKEY;
  api.lorawan.appeui.set(node_app_eui, 8); 
  api.lorawan.appkey.set(node_app_key, 16);
  api.lorawan.deui.set(node_device_eui, 8);
  
  api.lorawan.band.set(OTAA_BAND); 
  api.lorawan.deviceClass.set(RAK_LORA_CLASS_A);
  api.lorawan.njm.set(RAK_LORA_OTAA);
  
  api.lorawan.join();
  
}
 
void uplink_routine()
{
  
  uint8_t lenght;
  payload[lenght++] =  (uint8_t) 2;
  //payload[lenght++] =  (uint8_t) 5;
  
  Serial.println("send");
  //sending data packet
  api.lorawan.send(lenght, payload,3, false, 1);
}
 
void loop()
{ 
  uplink_routine();
  api.system.sleep.all(OTAA_PERIOD);
}