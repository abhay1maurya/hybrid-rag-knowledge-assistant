function toast(msg) {
  const note = document.getElementById('note');
  note.textContent = msg;
  note.classList.remove('hidden');
  
  setTimeout(() => {
    note.classList.add('hidden');
  }, 1800);
}

document.addEventListener('DOMContentLoaded', () => {
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('document-upload');

    // Make the styled button click the hidden file input
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => {
            fileInput.click();
        });

        // Listen for when the user actually selects a file
        fileInput.addEventListener('change', (event) => {
            const files = event.target.files;
            
            if (files.length > 0) {
                // Show a toast message with the file name
                if (files.length === 1) {
                    toast(`Uploading: ${files[0].name}...`);
                } else {
                    toast(`Uploading ${files.length} documents...`);
                }
                
                // Clear the input so the same file can be selected again if needed
                fileInput.value = ''; 
            }
        });
    }
});