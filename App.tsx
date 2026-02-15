
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { 
  QrCode, 
  Upload, 
  RefreshCcw, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Smartphone, 
  Zap, 
  ShieldCheck,
  X,
  Copy,
  History,
  Trash2,
  ArrowLeft,
  Share2,
  Wallet,
  Sparkles,
  Plus,
  Camera,
  StopCircle,
  Maximize
} from 'lucide-react';
import { analyzeQrisImage } from './services/geminiService';
import { generateDynamicQris, fileToBase64 } from './utils';
import * as QRCode from 'qrcode';

export interface QrisData {
  payload: string;
  merchantName?: string;
  nmid?: string;
  id?: string;
}

type AppView = 'input' | 'result';

export const App: React.FC = () => {
  const [view, setView] = useState<AppView>('input');
  const [staticQris, setStaticQris] = useState<QrisData | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [dynamicQrisPayload, setDynamicQrisPayload] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [savedMerchants, setSavedMerchants] = useState<QrisData[]>([]);
  const [showMerchantMenu, setShowMerchantMenu] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('qris_merchants');
    if (stored) {
      try {
        setSavedMerchants(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse merchants", e);
      }
    }
  }, []);

  const updateSavedMerchants = (newList: QrisData[]) => {
    setSavedMerchants(newList);
    localStorage.setItem('qris_merchants', JSON.stringify(newList));
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setError(null);
    setIsProcessing(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        // Start auto-capture loop
        scanIntervalRef.current = window.setInterval(captureAndAnalyzeFrame, 3000);
      }
    } catch (err: any) {
      setError("Izin kamera ditolak atau kamera tidak ditemukan.");
      setIsCameraActive(false);
    }
  };

  const captureAndAnalyzeFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !isCameraActive || isProcessing) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (context && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64 = canvas.toDataURL('image/png');
      
      setIsProcessing(true);
      try {
        const result = await analyzeQrisImage(base64);
        if (result.payload) {
          const newMerchant: QrisData = {
            payload: result.payload,
            merchantName: result.merchantName || "Merchant Terdeteksi",
            nmid: result.nmid || "NMID: Unknown",
            id: Date.now().toString()
          };
          setStaticQris(newMerchant);
          const exists = savedMerchants.some(m => m.payload === newMerchant.payload);
          if (!exists) {
            updateSavedMerchants([newMerchant, ...savedMerchants]);
          }
          stopCamera();
        }
      } catch (err) {
        // Silently continue scanning if frame analysis fails (e.g. no QR in frame)
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const base64 = await fileToBase64(file);
      const result = await analyzeQrisImage(base64);
      
      if (!result.payload) {
        throw new Error("Payload QRIS tidak ditemukan. Gunakan gambar yang lebih jelas.");
      }
      
      const newMerchant: QrisData = {
        payload: result.payload,
        merchantName: result.merchantName || "Merchant Baru",
        nmid: result.nmid || "NMID: Unknown",
        id: Date.now().toString()
      };

      setStaticQris(newMerchant);
      
      const exists = savedMerchants.some(m => m.payload === newMerchant.payload);
      if (!exists) {
        updateSavedMerchants([newMerchant, ...savedMerchants]);
      }
    } catch (err: any) {
      setError(err.message || "Gagal memproses gambar QRIS.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async () => {
    if (!staticQris || !amount) return;
    
    setIsProcessing(true);
    try {
      const dynamicPayload = generateDynamicQris(staticQris.payload, amount);
      setDynamicQrisPayload(dynamicPayload);
      
      const url = await QRCode.toDataURL(dynamicPayload, {
        width: 1000,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      setQrImageUrl(url);
      setView('result');
    } catch (err: any) {
      setError("Gagal enkripsi QRIS Dinamis.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetToHome = () => {
    setStaticQris(null);
    setAmount("");
    setDynamicQrisPayload(null);
    setQrImageUrl(null);
    setError(null);
    setView('input');
    stopCamera();
  };

  const copyToClipboard = () => {
    if (dynamicQrisPayload) {
      navigator.clipboard.writeText(dynamicQrisPayload);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const downloadQr = () => {
    if (qrImageUrl) {
      const link = document.createElement('a');
      link.href = qrImageUrl;
      link.download = `QRIS-${staticQris?.merchantName || 'Bayar'}-${amount}.png`;
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* Hidden canvas for camera frames */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Modal: Merchant List */}
      {showMerchantMenu && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 border-t-8 border-red-600">
            <div className="p-8 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <History className="text-red-600" /> Merchant
                </h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">History Tersimpan</p>
              </div>
              <button onClick={() => setShowMerchantMenu(false)} className="p-3 bg-white shadow-sm hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-6 space-y-3">
              {savedMerchants.length === 0 ? (
                <div className="py-20 text-center opacity-40">
                  <QrCode size={64} className="mx-auto mb-4 text-slate-300" />
                  <p className="font-bold">Belum ada merchant</p>
                </div>
              ) : (
                savedMerchants.map((merchant) => (
                  <div 
                    key={merchant.id}
                    onClick={() => { setStaticQris(merchant); setShowMerchantMenu(false); }}
                    className={`group flex items-center justify-between p-5 rounded-[2rem] cursor-pointer transition-all border-2 ${
                      staticQris?.id === merchant.id 
                        ? 'bg-emerald-50 border-emerald-500 shadow-md' 
                        : 'bg-slate-50 border-transparent hover:bg-white hover:border-red-200'
                    }`}
                  >
                    <div className="flex gap-4 items-center">
                      <div className={`p-3 rounded-2xl ${staticQris?.id === merchant.id ? 'bg-emerald-600 text-white' : 'bg-white shadow-sm text-red-600'}`}>
                        <Smartphone size={20} />
                      </div>
                      <div className="text-left">
                        <p className={`font-black text-sm uppercase ${staticQris?.id === merchant.id ? 'text-emerald-900' : 'text-slate-900'}`}>
                          {merchant.merchantName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{merchant.nmid}</p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        const newList = savedMerchants.filter(m => m.id !== merchant.id);
                        updateSavedMerchants(newList);
                        if (staticQris?.id === merchant.id) setStaticQris(null);
                      }}
                      className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-3">
              <button 
                onClick={() => { setShowMerchantMenu(false); fileInputRef.current?.click(); }}
                className="flex items-center justify-center gap-2 py-4 bg-white border-2 border-slate-100 text-slate-700 rounded-[1.5rem] font-black text-xs hover:border-red-500 hover:text-red-600 transition-all"
              >
                <Upload size={18} /> Upload
              </button>
              <button 
                onClick={() => { setShowMerchantMenu(false); startCamera(); }}
                className="flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-700 text-white rounded-[1.5rem] font-black text-xs shadow-lg shadow-red-200 transition-all active:scale-[0.98]"
              >
                <Camera size={18} /> Kamera
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main App Container */}
      <div className="max-w-2xl mx-auto px-6 py-8 md:py-12">
        
        {view === 'input' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-red-600 to-red-700 p-3.5 rounded-[1.2rem] shadow-xl shadow-red-100 rotate-2">
                  <QrCode className="text-white" size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tighter leading-none">
                    <span className="text-red-600">Qris</span> <span className="text-emerald-600">Selubang</span>
                  </h1>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1 flex items-center gap-1">
                    <Sparkles size={10} className="text-emerald-500" /> Next-Gen Generator
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowMerchantMenu(true)}
                className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-red-500 hover:text-red-600 transition-all group"
              >
                <History className="text-slate-400 group-hover:text-red-500" />
              </button>
            </div>

            {/* Merchant Upload Area */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 opacity-50 blur-2xl"></div>
              
              <div className="flex items-center justify-between mb-8 relative z-10">
                <h2 className="text-lg font-black flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-black">1</span>
                  Merchant Data
                </h2>
                {staticQris && (
                  <button onClick={() => setShowMerchantMenu(true)} className="text-[10px] font-black text-red-600 bg-red-50 px-3 py-1.5 rounded-full uppercase tracking-widest border border-red-100">
                    Switch
                  </button>
                )}
              </div>

              {!staticQris ? (
                <div className="space-y-4">
                  {isCameraActive ? (
                    <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-[4/3] shadow-inner border-4 border-red-600">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className="w-full h-full object-cover"
                      />
                      {/* Dimmed Background Overlay */}
                      <div className="absolute inset-0 bg-black/40" style={{
                        clipPath: 'polygon(0% 0%, 0% 100%, 15% 100%, 15% 15%, 85% 15%, 85% 85%, 15% 85%, 15% 100%, 100% 100%, 100% 0%)'
                      }} />
                      
                      {/* Viewfinder Overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="w-[70%] aspect-square border-2 border-emerald-500/30 rounded-3xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.1)]">
                           {/* Scanning Line */}
                           <div className="absolute inset-x-0 top-0 h-1 bg-red-500 animate-[scan_2s_infinite] shadow-[0_0_15px_rgba(239,68,68,0.8)] z-20"></div>
                           
                           {/* Corner Brackets */}
                           <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-emerald-500 rounded-tl-2xl z-20"></div>
                           <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-emerald-500 rounded-tr-2xl z-20"></div>
                           <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-emerald-500 rounded-bl-2xl z-20"></div>
                           <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-emerald-500 rounded-br-2xl z-20"></div>

                           {/* Center Icon Hint */}
                           <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                              <Maximize size={48} className="text-white" />
                           </div>
                        </div>

                        {/* Hint Text */}
                        <div className="mt-6 text-center z-20">
                          <p className="text-white text-[11px] font-black uppercase tracking-[0.2em] bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
                            Posisikan QRIS di tengah kotak
                          </p>
                        </div>
                      </div>

                      <div className="absolute bottom-6 inset-x-0 flex justify-center z-30">
                        <button 
                          onClick={stopCamera}
                          className="bg-red-600/90 hover:bg-red-600 text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 backdrop-blur-md shadow-xl active:scale-95 transition-all"
                        >
                          <StopCircle size={16} /> Batal Scan
                        </button>
                      </div>

                      {isProcessing && (
                         <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[4px] flex items-center justify-center z-40">
                           <div className="bg-white px-6 py-4 rounded-[1.5rem] flex items-center gap-4 shadow-2xl animate-in zoom-in-95">
                              <Loader2 className="animate-spin text-red-600" size={24} />
                              <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Memindai Kode...</span>
                           </div>
                         </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="group border-2 border-dashed border-slate-200 rounded-[2rem] p-8 hover:border-red-400 hover:bg-red-50/20 transition-all cursor-pointer text-center"
                      >
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          {isProcessing && !isCameraActive ? <Loader2 className="animate-spin text-red-600" size={24} /> : <Upload className="text-slate-300" size={24} />}
                        </div>
                        <p className="text-sm font-black text-slate-900">Upload QRIS</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">File Gambar</p>
                      </div>
                      <div 
                        onClick={startCamera}
                        className="group border-2 border-dashed border-slate-200 rounded-[2rem] p-8 hover:border-emerald-400 hover:bg-emerald-50/20 transition-all cursor-pointer text-center"
                      >
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <Camera className="text-slate-300 group-hover:text-emerald-500" size={24} />
                        </div>
                        <p className="text-sm font-black text-slate-900">Scan Kamera</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Langsung Scan</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gradient-to-r from-red-50/50 to-emerald-50/50 p-6 rounded-[2rem] border border-red-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-red-50 text-red-600">
                      <Smartphone size={28} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-widest italic mb-0.5">Verified Merchant</p>
                      <h3 className="text-xl font-black text-slate-900">{staticQris.merchantName}</h3>
                      <p className="text-xs text-slate-500 font-mono mt-1">{staticQris.nmid}</p>
                    </div>
                  </div>
                  <button onClick={() => setStaticQris(null)} className="p-3 text-slate-300 hover:text-red-600 transition-all">
                    <X />
                  </button>
                </div>
              )}

              {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold animate-in shake">
                  <AlertCircle size={20} /> {error}
                </div>
              )}
            </div>

            {/* Amount Section */}
            <div className={`bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 transition-all duration-500 ${!staticQris ? 'opacity-30 pointer-events-none scale-[0.98]' : 'opacity-100 scale-100'}`}>
              <h2 className="text-lg font-black mb-8 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-black">2</span>
                Payment Details
              </h2>

              <div className="space-y-6">
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">Rp</span>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] py-6 pl-16 pr-8 text-3xl font-black focus:outline-none focus:border-red-500 focus:bg-white transition-all placeholder:text-slate-100"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['10000', '25000', '50000', '100000'].map(val => (
                    <button 
                      key={val} 
                      onClick={() => setAmount(val)}
                      className={`py-3 rounded-2xl font-black text-xs transition-all border-2 ${amount === val ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-100' : 'bg-white border-slate-100 text-slate-500 hover:border-red-300 hover:text-red-600'}`}
                    >
                      {parseInt(val).toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleGenerate}
                disabled={!amount || isProcessing}
                className="w-full mt-10 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-red-600 hover:to-red-700 disabled:opacity-20 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-emerald-100 hover:shadow-red-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Zap size={22} className="text-yellow-300" />}
                Generate QR Dinamis
              </button>
            </div>
          </div>
        ) : (
          /* Result View */
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            <header className="flex items-center justify-between mb-8">
              <button onClick={() => setView('input')} className="flex items-center gap-2 text-red-600 font-black text-sm uppercase tracking-widest hover:translate-x-[-4px] transition-transform">
                <ArrowLeft size={18} /> Kembali
              </button>
              <div className="bg-emerald-600 text-white px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100">
                Live Dynamic QR
              </div>
            </header>

            <div className="bg-white rounded-[3rem] p-10 shadow-2xl shadow-slate-200 border border-slate-100 text-center relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-3 bg-gradient-to-r from-red-600 via-emerald-600 to-red-600"></div>
              
              <div className="space-y-2 mb-10">
                <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em]">Tagihan Pembayaran</p>
                <h3 className="text-5xl font-black tracking-tighter text-slate-900">Rp {parseInt(amount).toLocaleString()}</h3>
                <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold bg-emerald-50 px-4 py-1.5 rounded-full inline-flex mt-2">
                  <Wallet size={16} /> <span className="uppercase text-xs tracking-tight">{staticQris?.merchantName}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] border-4 border-slate-50 shadow-inner inline-block relative group">
                <img src={qrImageUrl!} alt="Dynamic QRIS" className="w-full max-w-[300px] aspect-square" />
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[2.5rem]">
                   <QrCode size={48} className="text-red-600" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-12">
                <button 
                  onClick={downloadQr}
                  className="flex flex-col items-center gap-2 bg-slate-50 hover:bg-emerald-600 hover:text-white border-2 border-slate-100 hover:border-emerald-600 p-6 rounded-[2rem] transition-all font-black text-[10px] uppercase tracking-widest active:scale-95"
                >
                  <Download size={28} /> Simpan Foto
                </button>
                <button 
                  onClick={() => {
                    if (navigator.share) {
                       fetch(qrImageUrl!).then(r => r.blob()).then(blob => {
                         const file = new File([blob], 'qris.png', { type: 'image/png' });
                         navigator.share({ files: [file], title: 'Bayar QRIS' });
                       });
                    }
                  }}
                  className="flex flex-col items-center gap-2 bg-slate-50 hover:bg-red-600 hover:text-white border-2 border-slate-100 hover:border-red-600 p-6 rounded-[2rem] transition-all font-black text-[10px] uppercase tracking-widest active:scale-95"
                >
                  <Share2 size={28} /> Bagikan
                </button>
              </div>

              <button 
                onClick={copyToClipboard}
                className={`w-full mt-4 flex items-center justify-center gap-3 py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] transition-all ${isCopied ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
              >
                {isCopied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                {isCopied ? "Berhasil Tersalin" : "Salin Payload"}
              </button>
            </div>

            <div className="mt-8 flex flex-col items-center gap-6">
              <div className="flex items-center gap-3 text-[10px] font-black text-emerald-600 bg-white border border-emerald-100 px-8 py-3 rounded-full uppercase tracking-widest shadow-sm">
                <ShieldCheck size={16} /> Verified Security Standard
              </div>
              <button onClick={resetToHome} className="text-red-600 font-black text-sm uppercase tracking-widest border-b-2 border-red-100 hover:border-red-600 transition-all">
                Transaksi Baru
              </button>
            </div>
          </div>
        )}

        <footer className="mt-20 text-center opacity-30 pb-12">
          <p className="text-[10px] font-black uppercase tracking-[0.4em]">© 2025 <span className="text-red-600">Qris</span> Selubang • Indo Fintech System</p>
        </footer>
      </div>
    </div>
  );
};
