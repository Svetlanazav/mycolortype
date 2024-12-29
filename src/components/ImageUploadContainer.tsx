import { useState, useRef } from "react";
import { Camera, Upload, X } from "lucide-react";

const ImageUploadContainer = () => {
  const [step, setStep] = useState(1); // 1: initial, 2: upload modal, 3: preview
  const [selectedImage, setSelectedImage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const handleFileUpload = (event: { target: { files: any[] } }) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target!.result);
        setShowModal(false);
        setStep(3);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
      const image = canvas.toDataURL("image/jpeg");
      setSelectedImage(image);
      setIsCameraActive(false);
      setShowModal(false);
      setStep(3);
      // Stop camera stream
      const stream = videoRef.current.srcObject;
      stream?.getTracks().forEach((track) => track.stop());
    }
  };

  const Modal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Select image</h3>
          <button
            onClick={() => setShowModal(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 px-4 border border-gray-300 rounded-lg flex items-center justify-center space-x-2 hover:bg-gray-50"
          >
            <Upload size={20} />
            <span>Upload from device</span>
          </button>

          <button
            onClick={startCamera}
            className="w-full py-3 px-4 border border-gray-300 rounded-lg flex items-center justify-center space-x-2 hover:bg-gray-50"
          >
            <Camera size={20} />
            <span>Take a photo</span>
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Step indicators */}
        <div className="flex justify-between mb-8">
          <div
            className={`flex flex-col items-center ${step >= 1 ? "text-pink-500" : "text-gray-300"}`}
          >
            <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center mb-2">
              1
            </div>
            <span className="text-sm">Upload</span>
          </div>
          <div
            className={`flex flex-col items-center ${step >= 2 ? "text-pink-500" : "text-gray-300"}`}
          >
            <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center mb-2">
              2
            </div>
            <span className="text-sm">Preview</span>
          </div>
          <div
            className={`flex flex-col items-center ${step >= 3 ? "text-pink-500" : "text-gray-300"}`}
          >
            <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center mb-2">
              3
            </div>
            <span className="text-sm">Analysis</span>
          </div>
        </div>

        {/* Main content area */}
        <div className="mb-6">
          {isCameraActive ? (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg"
              />
              <button
                onClick={takePhoto}
                className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-pink-500 text-white px-6 py-2 rounded-full hover:bg-pink-600"
              >
                Take Photo
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt="Selected"
                  className="max-h-[300px] rounded-lg object-contain"
                />
              ) : (
                <div className="text-center p-6">
                  <div className="mb-4">
                    <Upload size={48} className="mx-auto text-gray-400" />
                  </div>
                  <p className="text-gray-500 mb-2">Upload or take a photo</p>
                  <p className="text-sm text-gray-400">
                    Supported formats: JPG, PNG
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 transition-colors"
          >
            Upload Photo
          </button>
          <button
            onClick={() => {
              /* Handle analysis start */
            }}
            className={`px-6 py-2 rounded-full transition-colors ${
              selectedImage
                ? "bg-pink-500 text-white hover:bg-pink-600"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            disabled={!selectedImage}
          >
            Start Analysis
          </button>
        </div>

        {/* Upload modal */}
        {showModal && <Modal />}
      </div>
    </div>
  );
};

export default ImageUploadContainer;
