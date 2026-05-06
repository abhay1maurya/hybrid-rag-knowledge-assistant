function toast(msg) {
  const note = document.getElementById('note');
  note.textContent = msg;
  note.classList.remove('hidden');
  
  setTimeout(() => {
    note.classList.add('hidden');
  }, 1800);
}