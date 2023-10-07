import fetch from 'node-fetch';

const CHAT_API_URL = 'http://127.0.0.1:9888/ask';

// Send a request to ask_prts
export async function ask_prts(question) {
  // Use node-fetch to make requests
  const res = await fetch(CHAT_API_URL, {
    method: 'POST',
    body: JSON.stringify({content: question}),
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot',
    },
  });
  
  const data = await res.json();
  const response = data['content']

  // Log failures.
  if (!res.ok || response == undefined) {
    console.log('Ask prts failed.');
    console.log(res.status);
    console.log(JSON.stringify(data));
    return "Something wrong (bot)...";
  }
  return response;
}
