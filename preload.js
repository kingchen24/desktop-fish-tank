// preload.js - Electron 预加载脚本
// 安全暴露有限的 API 给渲染进程

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
});
