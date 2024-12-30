import React, { useState, useRef, type ChangeEvent } from "react";
import { Camera, Upload, X } from "lucide-react";
import { AnalysisPreview } from "./AnalysisPreviewContainer";

// Define types for component state
type Step = 1 | 2 | 3;

interface ModalProps {
  onClose: () => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onCameraStart: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const Modal: React.FC<ModalProps> = ({
  onClose,
  onFileUpload,
  onCameraStart,
  fileInputRef,
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg p-6 max-w-md w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Select image</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
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
          onClick={onCameraStart}
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
        onChange={onFileUpload}
        className="hidden"
      />
    </div>
  </div>
);

const ImageUploadContainer: React.FC = () => {
  const [step, setStep] = useState<Step>(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          setSelectedImage(result);
          setShowModal(false);
          setStep(2);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async (): Promise<void> => {
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

  const takePhoto = (): void => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext("2d");

      if (context) {
        context.drawImage(videoRef.current, 0, 0);
        const image = canvas.toDataURL("image/jpeg");
        setSelectedImage(image);
        setIsCameraActive(false);
        setShowModal(false);
        setStep(2);

        // Stop camera stream
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const startAnalysis = (): void => {
    if (selectedImage) {
      setStep(3);
    }
  };

  const samplePalette = [
    { hex: "#F5E6E8", name: "Soft Pink" },
    { hex: "#D5C3C6", name: "Dusty Rose" },
    { hex: "#B6A3A7", name: "Mauve" },
    { hex: "#947276", name: "Rose Brown" },
  ];
  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Step indicators */}
        <div className="flex justify-between mb-8">
          {[1, 2, 3].map((stepNumber) => {
            const isClickable =
              stepNumber === 1 ||
              (stepNumber === 2 && selectedImage) ||
              (stepNumber === 3 && selectedImage);

            return (
              <button
                key={stepNumber}
                onClick={() => {
                  if (isClickable) {
                    setStep(stepNumber as Step);
                  }
                }}
                disabled={!isClickable}
                className={`flex flex-col items-center ${
                  step === stepNumber ? "text-yellow-600" : "text-gray-300"
                } ${
                  isClickable
                    ? "cursor-pointer hover:text-accent-sage"
                    : "cursor-not-allowed"
                } transition-colors duration-200`}
              >
                <div
                  className={`w-8 h-8 rounded-full border-2 border-current flex items-center justify-center mb-2 ${
                    step === stepNumber ? "bg-white" : ""
                  }`}
                >
                  {stepNumber}
                </div>
                <span className="text-sm">
                  {stepNumber === 1
                    ? "Upload"
                    : stepNumber === 2
                      ? "Preview"
                      : "Analysis"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Main content area */}
        {/* <div className="mb-6">
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
        </div> */}
        {/* Main content area */}
        <div className="mb-6">
          {step === 1 && (
            <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
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
                <>
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
                      <p className="text-gray-500 mb-2">
                        Upload or take a photo
                      </p>
                      <p className="text-sm text-gray-400">
                        Supported formats: JPG, PNG
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {step === 2 && selectedImage && (
            <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <img
                src={selectedImage}
                alt="Selected"
                className="max-h-[300px] rounded-lg object-contain"
              />
            </div>
          )}

          {step === 3 && (
            <AnalysisPreview
              seasonalStyle={"Spring"}
              primaryColors={samplePalette}
              accentColors={samplePalette}
            />
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-2 bg-accent-sage text-white rounded-full hover:bg-accent-rose transition-colors"
          >
            Upload Photo
          </button>
          <button
            onClick={startAnalysis}
            className={`px-6 py-2 rounded-full transition-colors ${
              selectedImage
                ? "bg-accent-sage  text-white hover:bg-accent-rose"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            disabled={!selectedImage}
          >
            Start Analysis
          </button>
        </div>

        {/* Upload modal */}
        {showModal && (
          <Modal
            onClose={() => setShowModal(false)}
            onFileUpload={handleFileUpload}
            onCameraStart={startCamera}
            fileInputRef={fileInputRef}
          />
        )}
      </div>
    </div>
  );
};

export default ImageUploadContainer;
