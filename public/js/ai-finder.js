// Client-side interactions for AI Finder
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.ai-search-box');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  if (form && submitBtn) {
    form.addEventListener('submit', () => {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Groq LLM & Qdrant Search...';
    });
  }
});
