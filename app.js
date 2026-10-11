const CHUNK_SIZE = 64 * 1024;
const fixedId = "mi-id-fijo-para-testear";
const myIdElement = document.getElementById("myId");
const copyIdBtn = document.getElementById("copyIdBtn");
const remoteIdInput = document.getElementById("remoteId");
const connectBtn = document.getElementById("connectBtn");
const statusElement = document.getElementById("status");
const fileInput = document.getElementById("fileInput");
const sendBtn = document.getElementById("sendBtn");
const sendProgress = document.getElementById("sendProgress");
const sendInfo = document.getElementById("sendInfo");
const receiveInfo = document.getElementById("receiveInfo");
const receiveProgress = document.getElementById("receiveProgress");
const downloadLink = document.getElementById("downloadLink");

let peer = null;
let connection = null;
let selectedFile = null;
let incomingFile = null;
let receivedBytes = 0;
let lastObjectUrl = null;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function initializePeer() {
  peer = new Peer(fixedId);
  peer.on("open", (id) => {
    console.log("Peer abierto con ID:", id);
    myIdElement.textContent = id;
    copyIdBtn.disabled = false;
    statusElement.textContent = "Esperando conexión...";
  });
  peer.on("connection", (incomingConnection) => {
    setConnection(incomingConnection);
  });
  peer.on("error", (error) => {
    console.error(error);
    statusElement.textContent = `Error: ${error.type}`;
  });
}

function setConnection(newConnection) {
  connection = newConnection;
  connection.on("open", () => {
    statusElement.textContent = "Conectado. Ya puedes enviar archivos.";
    sendBtn.disabled = !selectedFile;
  });
  connection.on("close", () => {
    statusElement.textContent = "Conexión cerrada.";
    sendBtn.disabled = true;
    connection = null;
  });
  connection.on("error", (error) => {
    console.error(error);
    statusElement.textContent = "Error en la conexión.";
  });
  connection.on("data", handleIncomingData);
}

copyIdBtn.addEventListener("click", async () => {
  const id = myIdElement.textContent;
  if (!id || id === "Conectando...") return;
  try {
    await navigator.clipboard.writeText(id);
    const originalText = copyIdBtn.textContent;
    copyIdBtn.textContent = "¡Copiado!";
    setTimeout(() => {
      copyIdBtn.textContent = originalText;
    }, 1500);
  } catch (error) {
    alert("No se pudo copiar automáticamente. Copia el ID manualmente.");
  }
});

connectBtn.addEventListener("click", () => {
  const remoteId = remoteIdInput.value.trim();
  if (!remoteId) {
    alert("Introduce el ID del receptor.");
    return;
  }
  statusElement.textContent = "Conectando...";
  const newConnection = peer.connect(remoteId, { reliable: true });
  setConnection(newConnection);
});

fileInput.addEventListener("change", () => {
  selectedFile = fileInput.files[0] || null;
  if (!selectedFile) {
    sendInfo.textContent = "Ningún archivo seleccionado.";
    sendBtn.disabled = true;
    return;
  }
  sendInfo.textContent = `${selectedFile.name} — ${formatBytes(selectedFile.size)}`;
  sendBtn.disabled = !connection || !connection.open;
  sendProgress.value = 0;
});

sendBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    alert("Selecciona un archivo.");
    return;
  }
  if (!connection || !connection.open) {
    alert("No hay conexión activa.");
    return;
  }
  sendBtn.disabled = true;
  statusElement.textContent = "Enviando archivo...";
  connection.send({ 
    type: "file-start", 
    name: selectedFile.name, 
    size: selectedFile.size, 
    mimeType: selectedFile.type || "application/octet-stream" 
  });
  let offset = 0;
  try {
    while (offset < selectedFile.size) {
      const chunk = selectedFile.slice(offset, offset + CHUNK_SIZE);
      const buffer = await chunk.arrayBuffer();
      connection.send(buffer);
      offset += buffer.byteLength;
      const percent = Math.round((offset / selectedFile.size) * 100);
      sendProgress.value = percent;
      sendInfo.textContent = `Enviando ${selectedFile.name}: ${percent}% — ${formatBytes(offset)} de ${formatBytes(selectedFile.size)}`;
    }
    connection.send({ type: "file-end" });
    statusElement.textContent = "Archivo enviado correctamente.";
    sendInfo.textContent = `${selectedFile.name} — ${formatBytes(selectedFile.size)} enviado.`;
  } catch (error) {
    console.error(error);
    statusElement.textContent = "Error al enviar el archivo.";
  } finally {
    sendBtn.disabled = false;
  }
});

function handleIncomingData(data) {
  if (data instanceof ArrayBuffer) {
    if (!incomingFile) return;
    incomingFile.chunks.push(data);
    receivedBytes += data.byteLength;
    const percent = Math.round((receivedBytes / incomingFile.size) * 100);
    receiveProgress.value = percent;
    receiveInfo.textContent = `Recibiendo ${incomingFile.name}: ${percent}% — ${formatBytes(receivedBytes)} de ${formatBytes(incomingFile.size)}`;
    return;
  }
  if (data.type === "file-start") {
    incomingFile = { 
      name: data.name, 
      size: data.size, 
      mimeType: data.mimeType, 
      chunks: [] 
    };
    receivedBytes = 0;
    receiveProgress.value = 0;
    downloadLink.classList.add("hidden");
    receiveInfo.textContent = `Preparando recepción de ${data.name} — ${formatBytes(data.size)}`;
    return;
  }
  if (data.type === "file-end" && incomingFile) {
    const blob = new Blob(incomingFile.chunks, { type: incomingFile.mimeType });
    if (lastObjectUrl) {
      URL.revokeObjectURL(lastObjectUrl);
    }
    lastObjectUrl = URL.createObjectURL(blob);
    downloadLink.href = lastObjectUrl;
    downloadLink.download = incomingFile.name;
    downloadLink.textContent = `Descargar ${incomingFile.name}`;
    downloadLink.classList.remove("hidden");
    receiveInfo.textContent = `Archivo recibido: ${incomingFile.name} — ${formatBytes(incomingFile.size)}`;
    incomingFile = null;
  }
}

window.addEventListener("beforeunload", () => {
  if (lastObjectUrl) {
    URL.revokeObjectURL(lastObjectUrl);
  }
  if (connection) {
    connection.close();
  }
  if (peer) {
    peer.destroy();
  }
});

initializePeer();
