

async function trigger() {
  try {
    const res = await fetch('http://localhost:3001/api/cron/scrape', {
      headers: {
        'Authorization': 'Bearer undefined'
      }
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  } catch (e) {
    console.error('Error:', e);
  }
}

trigger();
