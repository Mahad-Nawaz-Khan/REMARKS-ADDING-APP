'use client'

import React, { useState } from "react";
import Head from "next/head";
import axios from "axios";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file first.");
      return;
    }
  
    const formData = new FormData();
    formData.append("file", file);
  
    try {
      const response = await axios.post(`${backendUrl}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
  
      setMessage(response.data.message);
      if (response.data.download_url) {
        setDownloadUrl(`${backendUrl}${response.data.download_url}`);
      }
    } catch (error) {
      console.error(error)
      setMessage("Error uploading file");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <Head>
        <title>File Upload</title>
      </Head>
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
        <h1 className="text-2xl mb-4">Upload a CSV or Excel File</h1>
        <input type="file" onChange={handleFileChange} className="mb-4 p-2 bg-gray-700 border border-gray-600 rounded" />
        <button
          onClick={handleUpload}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          Upload
        </button>
        {message && <p className="mt-4 text-green-400">{message}</p>}
        {downloadUrl && (
          <a href={downloadUrl} download className="block mt-4 text-blue-400 underline">
            Download Processed File
          </a>
        )}
      </div>
    </div>
  );
}
