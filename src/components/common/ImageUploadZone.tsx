import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  Check,
  X,
  Trash2,
  RefreshCw,
  Link,
  HardDrive,
  AlertCircle,
  FileCheck2,
  Maximize2,
} from 'lucide-react';
import { optimizeImageFile, formatFileSize } from '../../utils/imageOptimizer';

interface ImageUploadZoneProps {
  value: string;
  onChange: (imageUrl: string) => void;
  label?: string;
  helperText?: string;
  maxDimension?: number;
}

export const ImageUploadZone: React.FC<ImageUploadZoneProps> = ({
  value,
  onChange,
  label = 'Product / Menu Image',
  helperText = 'Upload from your computer (PNG, JPG, WebP) or paste an image URL',
  maxDimension = 1000,
}) => {
  const [activeMode, setActiveMode] = useState<'upload' | 'url'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadMetadata, setUploadMetadata] = useState<{
    fileName: string;
    originalSize: number;
    optimizedSize: number;
    dimensions: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      setErrorMessage(null);
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Only image files (PNG, JPG, WebP, SVG, GIF) are supported.');
        return;
      }

      // Allow files up to 25MB to be processed and compressed
      if (file.size > 25 * 1024 * 1024) {
        setErrorMessage('File size exceeds 25MB limit. Please choose a smaller file.');
        return;
      }

      setIsProcessing(true);
      try {
        const result = await optimizeImageFile(file, {
          maxWidth: maxDimension,
          maxHeight: maxDimension,
          quality: 0.85,
          outputFormat: 'image/webp',
        });

        onChange(result.dataUrl);
        setUploadMetadata({
          fileName: result.fileName,
          originalSize: result.originalSize,
          optimizedSize: result.optimizedSize,
          dimensions: result.width > 0 ? `${result.width}×${result.height}` : 'Vector SVG',
        });
      } catch (err: any) {
        console.error('[ImageUploadZone] Processing error:', err);
        setErrorMessage(err.message || 'Failed to process image file from storage.');
      } finally {
        setIsProcessing(false);
      }
    },
    [maxDimension, onChange]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
    // Reset file input value so selecting the same file again triggers change
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    onChange('');
    setUploadMetadata(null);
    setErrorMessage(null);
  };

  const hasImage = Boolean(value && value.trim());

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 dark:text-stone-300 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
          {label}
        </label>

        {/* Switch between local computer upload & web URL */}
        <div className="flex items-center gap-1 bg-stone-950/80 p-0.5 rounded-lg border border-slate-300 dark:border-white/10">
          <button
            type="button"
            id="btn-switch-upload-mode"
            onClick={() => setActiveMode('upload')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
              activeMode === 'upload'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-stone-400 hover:text-stone-200'
            }`}
          >
            <HardDrive className="w-3 h-3" />
            Computer Storage
          </button>
          <button
            type="button"
            id="btn-switch-url-mode"
            onClick={() => setActiveMode('url')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
              activeMode === 'url'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-stone-400 hover:text-stone-200'
            }`}
          >
            <Link className="w-3 h-3" />
            Web URL
          </button>
        </div>
      </div>

      {activeMode === 'upload' ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            id="menu-item-file-input"
            accept="image/png, image/jpeg, image/webp, image/gif, image/svg+xml"
            onChange={handleFileChange}
            className="hidden"
          />

          {!hasImage ? (
            /* Empty Upload & Drop Zone */
            <div
              id="menu-item-image-dropzone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200 cursor-pointer group ${
                isDragging
                  ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                  : 'border-slate-300 dark:border-white/15 bg-stone-950/50 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-stone-900/60'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-2.5">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    isDragging
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                      : 'bg-slate-50 dark:bg-stone-800 text-slate-700 dark:text-stone-300 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 border border-slate-200 dark:border-white/5'
                  }`}
                >
                  {isProcessing ? (
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  ) : (
                    <UploadCloud className="w-6 h-6" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white">
                    {isProcessing ? (
                      'Optimizing image...'
                    ) : (
                      <>
                        <span className="text-emerald-400 hover:underline">Click to browse</span> or drag and drop from your computer
                      </>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-stone-400">
                    Supports PNG, JPG, WebP, GIF, or SVG (Auto-optimized for POS performance)
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Active Image Preview Box with Controls */
            <div
              id="menu-item-image-preview-card"
              className="bg-stone-950/80 border border-slate-300 dark:border-white/10 rounded-2xl p-3 flex flex-col sm:flex-row items-center gap-3.5 shadow-inner"
            >
              {/* Thumbnail */}
              <div className="relative w-28 h-24 sm:w-32 sm:h-24 rounded-xl overflow-hidden bg-white dark:bg-stone-900 border border-slate-300 dark:border-white/10 shrink-0 group">
                <img
                  src={value}
                  alt="Menu Item Preview"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-slate-900/20 dark:bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-slate-900 dark:text-white backdrop-blur-sm cursor-pointer"
                    title="Change image"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Info & Action Buttons */}
              <div className="flex-1 min-w-0 space-y-2 w-full">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">Image Loaded</span>
                  </div>

                  <button
                    type="button"
                    id="btn-remove-image"
                    onClick={handleRemoveImage}
                    className="p-1 text-slate-500 dark:text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                    title="Remove image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {uploadMetadata && (
                  <div className="text-[11px] text-slate-500 dark:text-stone-400 space-y-0.5">
                    <div className="truncate font-mono text-slate-700 dark:text-stone-300">{uploadMetadata.fileName}</div>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-stone-400">
                      <span>{uploadMetadata.dimensions}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-mono">
                        {formatFileSize(uploadMetadata.optimizedSize)}
                      </span>
                      {uploadMetadata.originalSize > uploadMetadata.optimizedSize && (
                        <span className="text-slate-400 dark:text-stone-500 text-[10px]">
                          ({Math.round((1 - uploadMetadata.optimizedSize / uploadMetadata.originalSize) * 100)}% compressed)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    id="btn-change-image-file"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border border-slate-200 dark:border-white/5 active:scale-95"
                  >
                    <RefreshCw className="w-3 h-3 text-emerald-400" />
                    Choose Different File
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Web URL Mode */
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="url"
              id="menu-item-url-input"
              placeholder="https://images.unsplash.com/photo-..."
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setUploadMetadata(null);
                setErrorMessage(null);
              }}
              className="flex-1 px-3 py-2 bg-stone-950/80 border border-slate-300 dark:border-white/10 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500 transition shadow-inner font-mono"
            />
            {hasImage && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="px-3 py-2 bg-slate-50 dark:bg-stone-800 hover:bg-rose-950/50 hover:text-rose-400 text-slate-500 dark:text-stone-400 border border-slate-200 dark:border-white/5 rounded-xl text-xs transition cursor-pointer"
                title="Clear image URL"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {hasImage && (
            <div className="flex items-center gap-3 p-2 bg-stone-950/50 border border-slate-200 dark:border-white/5 rounded-xl">
              <img
                src={value}
                alt="URL Preview"
                className="w-12 h-12 rounded-lg object-cover bg-white dark:bg-stone-900 border border-slate-300 dark:border-white/10"
                referrerPolicy="no-referrer"
                onError={() => setErrorMessage('Unable to load image from the provided URL.')}
              />
              <div className="text-[11px] text-slate-500 dark:text-stone-400 truncate">
                <span className="text-emerald-400 font-medium">Preview available</span>
                <div className="truncate text-slate-400 dark:text-stone-500 font-mono text-[10px]">{value}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {helperText && !errorMessage && (
        <p className="text-[11px] text-slate-400 dark:text-stone-500 leading-normal">{helperText}</p>
      )}
    </div>
  );
};
