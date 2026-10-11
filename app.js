let peer;
let connectionEstablished = false;

document.getElementById('create').onclick = () => {
  peer = new SimplePeer({ initiator: true });
  peer.on('signal', data => {
    document.getElementById('offer').value = JSON.stringify(data);
  });
  setupPeerEvents();
};

document.getElementById('connect').onclick = () => {
  const offer = JSON.parse(document.getElementById('remoteOffer').value);
  peer = new SimplePeer();
  peer.signal(offer);
  setupPeerEvents();
};

function setupPeerEvents() {
  peer.on('connect', () => {
    connectionEstablished = true;
    document.getElementById('status').textContent = 'Conectado! ✅';
    document.getElementById('send').disabled = false;
  });
  
  peer.on('data', data => {
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'archivo_recibido';
    a.click();
  });
  
  document.getElementById('send').onclick = () => {
    const file = document.getElementById('file').files[0];
    if (file && connectionEstablished) {
      document.getElementById('status').textContent = 'Enviando...';
      const reader = new FileReader();
      reader.onload = () => {
        peer.send(reader.result);
        document.getElementById('status').textContent = 'Enviado! ✅';
      };
      reader.readAsArrayBuffer(file);
    }
  };
}
