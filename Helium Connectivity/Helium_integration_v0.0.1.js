
  function Decoder(bytes, port) {
  var str = "";
  var bufferHEX = []
  for (var i = 0; i < bytes.length; i++) {
    var tmpo;
    var num = bytes[i];
    if (num < 0) {
      tmpo = (255 + num + 1).toString(16);
    } else {
      tmpo = num.toString(16);
    }
    if (tmpo.length == 1) {
      tmpo = "0" + tmpo;
    }
    str += tmpo;
  for (var j = 0; j < bytes.length; j++) {
    var arr = [];
     arr[j] =  bytes[j].toString(16);
     bufferHEX[j] = parseInt(arr[j], 10);
  }
}
  return { String:str,
  Port: port,
  BufferInteger: bytes,
  BufferHEX: bufferHEX,
  
}
}