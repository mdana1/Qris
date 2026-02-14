
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
  CreditCard,
  X,
  Copy,
  History,
  Trash2,
  ChevronLeft,
  Plus,
  ArrowLeft,
  Share2,
  Wallet
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
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [savedMerchants, setSavedMerchants] = useState<QrisData[]>([]);
  const [showMerchantMenu, setShowMerchantMenu] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('qris_merchants');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSavedMerchants(parsed);
      } catch (e) {
        console.error("Failed to parse saved merchants", e);
      }
    }
  }, []);

  const updateSavedMerchants = (newList: QrisData[]) => {
    setSavedMerchants(newList);
    localStorage.setItem('qris_merchants', JSON.stringify(newList));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setDynamicQrisPayload(null);
    setQrImageUrl(null);

    try {
      const base64 = await fileToBase64(file);
      const result = await analyzeQrisImage(base64);
      
      if (!result.payload) {
        throw new Error("Gagal membaca payload QRIS. Pastikan gambar jelas.");
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

  const selectMerchant = (merchant: QrisData) => {
    setStaticQris(merchant);
    setDynamicQrisPayload(null);
    setQrImageUrl(null);
    setShowMerchantMenu(false);
    setError(null);
  };

  const removeMerchant = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newList = savedMerchants.filter(m => m.id !== id);
    updateSavedMerchants(newList);
    if (staticQris?.id === id) {
      setStaticQris(null);
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
      setError("Gagal membuat QRIS dinamis.");
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setStaticQris(null);
    setAmount("");
    setDynamicQrisPayload(null);
    setQrImageUrl(null);
    setError(null);
    setView('input');
  };

  const backToInput = () => {
    setView('input');
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

  const handleShare = async () => {
    if (qrImageUrl) {
      try {
        const response = await fetch(qrImageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'qris.png', { type: 'image/png' });
        
        if (navigator.share) {
          await navigator.share({
            files: [file],
            title: `QRIS - ${staticQris?.merchantName}`,
            text: `Silahkan scan untuk membayar Rp ${parseInt(amount).toLocaleString()}`
          });
        } else {
          copyToClipboard();
        }
      } catch (error) {
        console.error("Error sharing:", error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center">
      
      {/* Merchant Management Modal */}
      {showMerchantMenu && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 border-t-8 border-red-500">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Daftar Merchant</h2>
                <p className="text-sm text-slate-500 font-medium italic">Manajemen Toko Anda</p>
              </div>
              <button onClick={() => setShowMerchantMenu(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            
            <div className="max-h-[50vh] overflow-y-auto p-6 space-y-4">
              {savedMerchants.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-50">
                    <History size={32} className="opacity-20 text-red-900" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">Belum ada merchant tersimpan</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {savedMerchants.map((merchant) => (
                    <div 
                      key={merchant.id}
                      onClick={() => selectMerchant(merchant)}
                      className={`group flex items-center justify-between p-5 rounded-3xl cursor-pointer transition-all border-2 ${
                        staticQris?.id === merchant.id 
                          ? 'bg-red-50 border-red-500 shadow-md' 
                          : 'bg-slate-50 border-transparent hover:bg-white hover:border-emerald-200'
                      }`}
                    >
                      <div className="flex gap-4 items-center">
                        <div className={`p-3 rounded-2xl border transition-colors ${
                          staticQris?.id === merchant.id ? 'bg-red-600 text-white border-red-400' : 'bg-white text-emerald-600 border-slate-200'
                        }`}>
                          <Smartphone size={22} />
                        </div>
                        <div className="text-left">
                          <p className={`font-black text-sm uppercase tracking-tight ${staticQris?.id === merchant.id ? 'text-red-900' : 'text-slate-900'}`}>
                            {merchant.merchantName}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono mt-1 opacity-70 truncate max-w-[150px]">{merchant.nmid}</p>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => removeMerchant(e, merchant.id!)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-white rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-4">
              <button 
                onClick={() => { setShowMerchantMenu(false); fileInputRef.current?.click(); }}
                className="w-full flex items-center justify-center gap-3 py-4 bg-red-600 hover:bg-red-700 text-white rounded-[1.5rem] font-black text-sm shadow-lg shadow-red-200 transition-all active:scale-[0.98]"
              >
                <Plus size={18} /> Tambah Merchant Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <div className="w-full max-w-4xl p-4 md:p-8 flex flex-col min-h-screen">
        
        {view === 'input' ? (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500">
            {/* Header */}
            <header className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-emerald-600 to-red-600 p-3 rounded-2xl shadow-xl shadow-red-200/50 rotate-3 group hover:rotate-0 transition-transform cursor-pointer">
                  <QrCode className="text-white" size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tighter">
                    <span className="text-emerald-600">Qris</span> <span className="text-red-600">Selubang</span>
                  </h1>
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    Hijau Merah Edition
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowMerchantMenu(true)}
                className="flex items-center gap-3 bg-white border-2 border-red-100 text-red-700 font-black py-3 px-6 rounded-2xl text-xs hover:border-red-500 hover:bg-red-50 transition-all shadow-sm active:scale-95"
              >
                <History size={18} className="text-emerald-500" />
                <span className="hidden sm:inline">Tersimpan</span>
                <span className="sm:hidden">Daftar</span>
              </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-12 space-y-6">
                {/* Step 1: Merchant Selection */}
                <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-sm font-black">1</div>
                      Merchant
                    </h2>
                    {staticQris && (
                      <button 
                        onClick={() => setShowMerchantMenu(true)}
                        className="text-xs font-black text-red-600 hover:text-red-700 bg-red-50 py-2 px-4 rounded-full flex items-center gap-2 transition-colors border border-red-100"
                      >
                        <RefreshCcw size={12} /> Ganti Merchant
                      </button>
                    )}
                  </div>

                  {!staticQris ? (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="group relative border-2 border-dashed border-red-100 rounded-[2rem] p-10 transition-all hover:border-red-400 hover:bg-red-50/30 cursor-pointer text-center"
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-white transition-all shadow-sm border border-red-50">
                          {isProcessing ? (
                            <Loader2 className="animate-spin text-red-600" size={36} />
                          ) : (
                            <Upload className="text-emerald-400 group-hover:text-red-600" size={36} />
                          )}
                        </div>
                        <p className="text-lg font-black text-slate-900 mb-2">
                          {isProcessing ? "Membaca..." : "Upload QRIS Statis"}
                        </p>
                        <p className="text-xs font-medium text-slate-400 max-w-[200px] mx-auto leading-relaxed">
                          Scan atau upload gambar QRIS toko anda.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-emerald-50 to-red-50 border border-emerald-100 rounded-[2rem] p-6 relative">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-4 items-center">
                          <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm">
                            <Smartphone className="text-red-600" size={28} />
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Merchant Aktif</p>
                            <h3 className="text-xl font-black text-slate-900 leading-none">{staticQris.merchantName}</h3>
                            <p className="text-xs text-slate-500 mt-2 font-mono bg-white/60 px-2 py-1 rounded inline-block">{staticQris.nmid}</p>
                          </div>
                        </div>
                        <button onClick={reset} className="p-3 text-slate-300 hover:text-red-600 transition-colors">
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="mt-6 p-5 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-600 text-sm animate-in shake">
                      <AlertCircle size={20} className="shrink-0" />
                      <p className="font-bold">{error}</p>
                    </div>
                  )}
                </div>

                {/* Step 2: Amount Input */}
                <div className={`bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-100 transition-all duration-500 ${!staticQris ? 'opacity-30 pointer-events-none scale-[0.98]' : 'opacity-100 scale-100'}`}>
                  <h2 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-sm font-black">2</div>
                    Nominal Pembayaran
                  </h2>
                  
                  <div className="space-y-6">
                    <div className="relative group">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300 group-focus-within:text-red-500 transition-colors">Rp</span>
                      <input 
                        type="number" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] py-6 pl-16 pr-8 text-3xl font-black focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all placeholder-slate-200"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {['10000', '25000', '50000', '100000'].map((preset) => (
                        <button 
                          key={preset}
                          onClick={() => setAmount(preset)}
                          className="py-3 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black text-slate-600 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all active:scale-95"
                        >
                          {parseInt(preset).toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={handleGenerate}
                    disabled={!amount || isProcessing}
                    className="w-full mt-10 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-red-600 hover:to-red-700 disabled:opacity-20 text-white font-black py-5 rounded-[1.5rem] shadow-2xl shadow-emerald-200 hover:shadow-red-200 flex items-center justify-center gap-4 transition-all active:scale-[0.98]"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <Zap size={24} className="text-yellow-300" />}
                    Buat QRIS Dinamis
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Result View */
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col items-center">
            {/* Header Result */}
            <header className="w-full flex items-center justify-between mb-8">
              <button 
                onClick={backToInput}
                className="flex items-center gap-2 text-red-600 font-bold hover:text-red-800 transition-colors"
              >
                <ArrowLeft size={20} /> Kembali
              </button>
              <div className="bg-red-600 text-white px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-200">
                Generated Successfully
              </div>
            </header>

            <div className="w-full max-w-md bg-white rounded-[3rem] p-8 shadow-2xl shadow-red-100 border-t-8 border-emerald-600 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full -mr-12 -mt-12 opacity-30"></div>
              
              <div className="w-full space-y-2 mb-8 relative z-10">
                <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] italic">Total Tagihan</p>
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Rp {parseInt(amount).toLocaleString()}</h3>
                <div className="flex items-center justify-center gap-2 text-emerald-600 font-black text-xs bg-emerald-50 py-1.5 px-4 rounded-full inline-flex">
                  <Wallet size={14} />
                  <span className="uppercase">{staticQris?.merchantName}</span>
                </div>
              </div>

              <div className="w-full bg-white p-6 rounded-[2.5rem] border-4 border-red-50 shadow-sm mb-8 relative group">
                <img src={qrImageUrl!} alt="Dynamic QRIS" className="w-full aspect-square object-contain" />
                <div className="absolute top-4 right-4 bg-emerald-500 text-white p-1 rounded-full shadow-md">
                   <CheckCircle2 size={16} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full">
                <button 
                  onClick={downloadQr}
                  className="flex flex-col items-center justify-center gap-2 bg-emerald-50 border-2 border-emerald-100 text-emerald-700 font-black py-4 rounded-3xl hover:bg-emerald-600 hover:text-white transition-all group"
                >
                  <Download size={24} className="text-emerald-500 group-hover:text-white" />
                  <span className="text-[10px] uppercase">Simpan Gambar</span>
                </button>
                <button 
                  onClick={handleShare}
                  className="flex flex-col items-center justify-center gap-2 bg-red-50 border-2 border-red-100 text-red-700 font-black py-4 rounded-3xl hover:bg-red-600 hover:text-white transition-all group"
                >
                  <Share2 size={24} className="text-red-400 group-hover:text-white" />
                  <span className="text-[10px] uppercase">Bagikan</span>
                </button>
              </div>

              <button 
                onClick={copyToClipboard}
                className={`w-full mt-4 flex items-center justify-center gap-2 font-black py-4 rounded-3xl transition-all text-xs uppercase tracking-widest border-2 ${
                  isCopied ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 text-white border-transparent hover:bg-slate-800 shadow-xl'
                }`}
              >
                {isCopied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                {isCopied ? 'Payload Tersalin' : 'Salin Raw Payload'}
              </button>
            </div>

            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="flex items-center gap-3 text-[10px] font-black text-white bg-emerald-600 py-3 px-8 rounded-full uppercase tracking-widest shadow-lg shadow-emerald-200">
                <ShieldCheck size={16} /> Verifikasi EMVCo Compliance
              </div>
              <button 
                onClick={reset}
                className="text-red-500 hover:text-red-800 font-black text-sm transition-colors border-b-2 border-transparent hover:border-red-500"
              >
                Transaksi Baru
              </button>
            </div>
          </div>
        )}

        <footer className="mt-auto text-center py-12 opacity-40">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">© 2025 <span className="text-emerald-600">Qris</span> <span className="text-red-600">Selubang</span> • Indo Fintech Standards</p>
        </footer>
      </div>
    </div>
  );
};
