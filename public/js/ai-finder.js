// Client-side interactions for AI Finder
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.ai-search-box');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  if (form && submitBtn) {
    form.addEventListener('submit', (e) => {
      // Show loading indicator without cancelling form POST submit
      setTimeout(() => {
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Groq LLM & Vector Search...';
      }, 50);
    });
  }
});
