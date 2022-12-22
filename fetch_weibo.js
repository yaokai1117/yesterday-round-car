
import fetch from 'node-fetch';
import { WeiboPost } from './weibo_utils.js';

const WEIBO_API_PREFIX = 'https://m.weibo.cn/';

// Fetch the last 10 post of a user.
export async function fetchLatestPosts(userId) {
  // API endpoint to get all posts of a user.
  const url = `${WEIBO_API_PREFIX}api/container/getIndex?containerid=107603${userId}&uid=${userId}`;
  // Use node-fetch to make requests
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot',
    },
  });
  
  const data = await res.json();
  const results = [];

  // Log failures.
  if (!res.ok || data['ok'] != 1 || data['data'] == undefined) {
    console.log(res.status);
    console.log(JSON.stringify(data));
    return results;
  }
  const cards = data['data']['cards'];
  for (const card of cards) {
    const post = new WeiboPost(card);
    if (post.isLongText) {
    }
    populateLongText(post);
    results.push(post);
  }

  return results;
}

async function populateLongText(weiboPost) {
  const url =  `${WEIBO_API_PREFIX}statuses/show?id=${weiboPost.id}`;
  console.log(`Send requet to: ${url}`);
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot',
    },
  });

  const data = await res.json();
    
  // Log failures.
  if (!res.ok || data['data'] == undefined) {
    console.log(res.status);
    console.log(JSON.stringify(data));
    return;
  }
  weiboPost.text = data['data']['text'];
}