/* AndHub local QR creator. Requires locally vendored qrcode-generator (MIT). */
(() => {
  const form = document.getElementById('qr-generator-form');
  if (!form) return;
  const scriptSource = document.currentScript?.src || new URL('assets/scripts/qr-generator.js', document.baseURI).href;
  const input = document.getElementById('qr-destination');
  const status = document.getElementById('qr-generator-status');
  const result = document.getElementById('qr-generator-result');
  const canvas = document.getElementById('qr-generator-canvas');
  const pngLink = document.getElementById('qr-download-png');
  const jpgLink = document.getElementById('qr-download-jpg');
  const submit = form.querySelector('button[type="submit"]');
  const context = canvas.getContext('2d');
  let generation = 0;
  const logo = new Image();
  const logoLoaded = new Promise((resolve, reject) => {
    logo.onload = resolve;
    logo.onerror = () => reject(new Error('The brand symbol could not be loaded. Please reload this page.'));
  });
  logoLoaded.catch(() => {});
  logo.src = new URL('../logos/svg/symbol/andhub-symbol-mono-navy.svg', scriptSource).href;
  input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'),status.id].filter(Boolean).join(' '));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const attempt = ++generation;
    result.hidden = true;
    pngLink.removeAttribute('href');
    jpgLink.removeAttribute('href');
    input.removeAttribute('aria-invalid');
    status.textContent = '';
    let destination;
    try {
      destination = new URL(input.value.trim());
      if (destination.protocol !== 'https:' || !destination.hostname || destination.username || destination.password) throw new Error();
      if (destination.href.length > 1200) throw new Error('long');
    } catch (error) {
      input.setAttribute('aria-invalid', 'true');
      status.textContent = error.message === 'long' ? 'This URL is too long. Use a direct HTTPS destination under 1,200 characters.' : 'Enter a complete HTTPS website or social URL, such as https://1hubengineering.com.';
      input.focus();
      return;
    }
    submit.disabled = true;
    status.textContent = 'Creating your branded QR code…';
    try {
      await logoLoaded;
      if (attempt !== generation) return;
      const qr = window.qrcode(0,'H');
      qr.addData(destination.href,'Byte');
      qr.make();
      const count = qr.getModuleCount();
      const quiet = 4;
      const total = count + quiet * 2;
      const cell = Math.floor(1536 / total);
      canvas.width = canvas.height = total * cell;
      context.fillStyle = '#FFFFFF';
      context.fillRect(0,0,canvas.width,canvas.height);
      for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
        if (!qr.isDark(row,col)) continue;
        const finder = (row < 7 && col < 7) || (row < 7 && col >= count-7) || (row >= count-7 && col < 7);
        context.fillStyle = finder ? '#2563EB' : '#0B1F3B';
        context.fillRect((col+quiet)*cell,(row+quiet)*cell,cell,cell);
      }
      const badge = Math.max(3,Math.floor(count * .14))*cell;
      const start = (canvas.width-badge)/2;
      const inset = badge*.1;
      context.fillStyle = '#FFFFFF';
      context.fillRect(start,start,badge,badge);
      context.drawImage(logo,start+inset,start+inset,badge-inset*2,badge-inset*2);
      pngLink.href = canvas.toDataURL('image/png');
      jpgLink.href = canvas.toDataURL('image/jpeg',1);
      result.hidden = false;
      canvas.setAttribute('role','img');
      canvas.setAttribute('aria-label',`AndHub branded QR code for ${destination.href}`);
      status.textContent = `Ready for ${destination.href}. Download PNG or JPG. Generated on your device; your URL is not uploaded.`;
    } catch (error) {
      if (attempt !== generation) return;
      status.textContent = error.message.includes('brand symbol') ? error.message : 'The QR code could not be created. Try a shorter HTTPS URL and generate again.';
    } finally {
      if (attempt === generation) submit.disabled = false;
    }
  });
})();
