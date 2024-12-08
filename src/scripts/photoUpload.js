document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const previewContainer = document.getElementById("previewContainer");
  const previewImage = document.getElementById("previewImage");
  const uploadCTA = document.getElementById("uploadCTA");

  // Preview the selected image
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        previewImage.src = reader.result;
        previewContainer.classList.remove("hidden");
        uploadCTA.classList.add("hidden");
      };
      reader.readAsDataURL(file);
      previewContainer.classList.add("hidden");
    } else {
      previewContainer.classList.remove("hidden");
      previewImage.src = "";
    }
  });
});
