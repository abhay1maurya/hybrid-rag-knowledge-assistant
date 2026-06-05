// Function to handle the support ticket submission demo
function submitTicket(e) {
  e.preventDefault();
  
  const ticketNote = document.getElementById('ticket');
  
  // Show the success message
  ticketNote.classList.remove('hidden');
  
  // Hide it again after 1.8 seconds
  setTimeout(() => {
    ticketNote.classList.add('hidden');
  }, 1800);
  
  // Optional: Reset form fields here if desired
  // e.target.reset();
}