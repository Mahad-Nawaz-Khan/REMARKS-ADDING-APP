'use client'

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { FiUpload, FiFile, FiX, FiDownload, FiCheck } from "react-icons/fi";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('✅ Service Worker Registered'))
      .catch(err => console.log('Service Worker Failed:', err));
  }
}, []);


  // Reset success message after 5 seconds
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  // Simulate upload progress
  useEffect(() => {
    if (isUploading && uploadProgress < 95) {
      const timer = setTimeout(() => {
        setUploadProgress(prev => prev + Math.random() * 10);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isUploading, uploadProgress]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setMessage("");
      setDownloadUrl("");
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const fileType = droppedFile.type;
      
      if (fileType === "text/csv" || 
          fileType === "application/vnd.ms-excel" || 
          fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
        setFile(droppedFile);
        setFileName(droppedFile.name);
        setMessage("");
        setDownloadUrl("");
      } else {
        setMessage("Please upload a CSV or Excel file");
      }
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file first.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setMessage("Uploading file...");
    // Keep the file state during upload
    const currentFile = file;
    const currentFileName = fileName;

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Step 1: Upload the file and get the file_id
      const uploadResponse = await axios.post(`${backendUrl}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000, // 2 minutes timeout
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 100)
          );
          // Cap at 50% since processing happens after upload
          setUploadProgress(Math.min(50, percentCompleted));
        }
      });
      
      if (!uploadResponse.data.file_id) {
        throw new Error("No file ID received from server");
      }
      
      const fileId = uploadResponse.data.file_id;
      setMessage("File uploaded. Processing...");
      
      // Step 2: Poll for status until processing is complete
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = 60; // Try for up to 60 seconds (12 attempts, 5 seconds each)
      
      while (!processingComplete && attempts < maxAttempts) {
        attempts++;
        
        try {
          // Wait 2 seconds between status checks
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const statusResponse = await axios.get(`${backendUrl}/status/${fileId}`);
          const status = statusResponse.data.status;
          
          // Update progress based on status
          if (status === "processing") {
            // Gradually increase progress from 50% to 90% during processing
            const processingProgress = 50 + Math.min(40, attempts * 2);
            setUploadProgress(processingProgress);
          } else if (status === "completed") {
            setUploadProgress(100);
            setMessage(statusResponse.data.message || "File processed successfully!");
            setShowSuccess(true);
            
            if (statusResponse.data.download_url) {
              const fullDownloadUrl = `${backendUrl}${statusResponse.data.download_url}`;
              setDownloadUrl(fullDownloadUrl);
              console.log("Download URL set:", fullDownloadUrl);
            }
            
            processingComplete = true;
          } else if (status === "error") {
            throw new Error(statusResponse.data.message || "Error processing file");
          }
        } catch (statusError) {
          console.error("Error checking status:", statusError);
          // Continue polling even if a status check fails
        }
      }
      
      if (!processingComplete) {
        throw new Error("Processing timed out. The file might be too large.");
      }
      
      // Ensure we still have the file information after the process completes
      setFile(currentFile);
      setFileName(currentFileName);
    } catch (error: any) {
      console.error("Upload error:", error);
      
      // Provide more specific error messages
      if (error.code === 'ECONNABORTED') {
        setMessage("Upload timed out. The file might be too large or the server is busy. Please try again.");
      } else {
        setMessage(error.message || error.response?.data?.message || "Error uploading file. Please try again.");
      }
      
      setShowSuccess(false);
      // Keep the file information even if there's an error
      setFile(currentFile);
      setFileName(currentFileName);
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setFileName("");
    setMessage("");
    setDownloadUrl("");
    setUploadProgress(0);
    setShowSuccess(false);
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 25,
        duration: 0.4 
      }
    },
    hover: { 
      y: -5,
      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      transition: { type: "spring", stiffness: 400, damping: 17 }
    }
  };

  const buttonVariants = {
    initial: { scale: 1 },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 }
  };

  const dropzoneVariants = {
    initial: { 
      backgroundColor: "rgba(0, 0, 0, 0)",
      borderColor: "var(--input-border)"
    },
    dragging: { 
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      borderColor: "var(--primary)",
      scale: 1.02,
      transition: { type: "spring", stiffness: 400, damping: 20 }
    },
    hover: {
      borderColor: "var(--primary)",
      backgroundColor: "rgba(59, 130, 246, 0.05)",
      transition: { duration: 0.2 }
    }
  };

  return (
    <motion.main 
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-[#1a1c2e] text-foreground p-4"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header with animated title */}
      <motion.div 
        className="w-full max-w-4xl mb-8 text-center"
        variants={itemVariants}
      >
        <motion.h1 
          className="text-4xl md:text-5xl font-bold mb-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            type: "spring",
            stiffness: 300,
            damping: 20,
            delay: 0.2
          }}
        >
          <motion.span 
            className="text-primary"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            Remarks
          </motion.span>{" "}
          <motion.span
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            Adding App
          </motion.span>
        </motion.h1>
        <motion.p 
          className="text-lg opacity-80 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          Upload your CSV or Excel files and process them with ease
        </motion.p>
      </motion.div>

      {/* Main Card */}
      <motion.div 
        className="w-full max-w-2xl p-8 bg-card-bg border border-card-border rounded-xl shadow-lg"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover="hover"
      >
        {/* File Upload Area */}
        <motion.div 
          className="w-full h-48 mb-6 flex flex-col items-center justify-center border-2 border-dashed rounded-lg"
          variants={dropzoneVariants}
          initial="initial"
          animate={isDragging ? "dragging" : "initial"}
          whileHover="hover"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileInput}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div 
                key="upload-prompt"
                className="flex flex-col items-center justify-center"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div 
                  className="text-5xl mb-3 text-primary"
                  animate={{ 
                    y: [0, -10, 0],
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    repeatType: "loop", 
                    duration: 2,
                    repeatDelay: 1
                  }}
                >
                  <FiUpload size={50} />
                </motion.div>
                <p className="text-lg font-medium mb-1">Drag & drop your file here</p>
                <p className="text-sm opacity-70">or click to browse</p>
                <p className="text-xs mt-2 opacity-50">Supports CSV and Excel files</p>
              </motion.div>
            ) : (
              <motion.div 
                key="file-selected"
                className="flex flex-col items-center"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div 
                  className="text-4xl mb-3 text-primary"
                  animate={{ 
                    scale: [1, 1.1, 1],
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    repeatType: "loop", 
                    duration: 2,
                    repeatDelay: 0.5
                  }}
                >
                  <FiFile size={40} />
                </motion.div>
                <p className="font-medium text-center break-all max-w-full">{fileName}</p>
                <motion.button 
                  onClick={(e) => {
                    e.stopPropagation();
                    resetForm();
                  }}
                  className="mt-3 text-sm text-error hover:underline flex items-center gap-1"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FiX size={14} />
                  <span>Remove</span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Upload Progress */}
        <AnimatePresence>
          {isUploading && (
            <motion.div 
              className="mb-6 w-full"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between text-sm mb-1">
                <span>
                  {uploadProgress < 100 
                    ? "Processing your file..." 
                    : "Upload complete!"}
                </span>
                <span>{Math.min(Math.round(uploadProgress), 100)}%</span>
              </div>
              <div className="w-full bg-input-bg rounded-full h-2 overflow-hidden">
                <motion.div 
                  className="bg-primary h-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.min(uploadProgress, 100)}%` }}
                  transition={{ duration: 0.3 }}
                ></motion.div>
              </div>
              {uploadProgress < 100 && (
                <p className="text-xs mt-2 text-center opacity-70">
                  Please wait while we process your file. This may take a moment...
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <motion.div 
          className="flex flex-col sm:flex-row gap-3 justify-center"
          variants={itemVariants}
        >
          <motion.button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className={`px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${!file || isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary text-white'}`}
            variants={buttonVariants}
            whileHover={!file || isUploading ? {} : "hover"}
            whileTap={!file || isUploading ? {} : "tap"}
            initial="initial"
          >
            {isUploading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              'Process File'
            )}
          </motion.button>
        </motion.div>

        {/* Success Message */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div 
              className="mt-6 p-4 bg-success bg-opacity-10 border border-success text-success rounded-lg"
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <div className="flex items-center gap-2">
                <FiCheck className="text-success" size={18} />
                <p className="font-medium">{message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        <AnimatePresence>
          {message && !showSuccess && (
            <motion.div 
              className="mt-6 p-4 bg-error bg-opacity-10 border border-error text-error rounded-lg"
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <p className="font-medium">{message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Download Link */}
        <AnimatePresence>
          {downloadUrl && downloadUrl.length > 0 && (
            <motion.div 
              className="mt-6"
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <motion.a 
                href={downloadUrl} 
                download 
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-medium"
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                initial="initial"
                onClick={(e) => {
                  console.log("Download button clicked, URL:", downloadUrl);
                }}
              >
                <FiDownload size={18} />
                <span>Download Processed File</span>
              </motion.a>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <motion.footer 
        className="mt-12 text-center text-sm opacity-70"
        variants={itemVariants}
      >
        <p> {new Date().getFullYear()} Remarks Adding App. All rights reserved.</p>
      </motion.footer>
    </motion.main>
  );
}
