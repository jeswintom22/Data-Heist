export function canvasPointToCell(clientX, clientY, rect, logicalSize, gridSize) {
  const scaleX = logicalSize / rect.width;
  const scaleY = logicalSize / rect.height;
  return {
    x: Math.floor(((clientX - rect.left) * scaleX) / (logicalSize / gridSize)),
    y: Math.floor(((clientY - rect.top) * scaleY) / (logicalSize / gridSize)),
  };
}
