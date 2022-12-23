
import fetch from 'node-fetch';
import fs from 'fs';
import TurndownService from 'turndown';
import { WeiboPost } from './weibo_utils.js';

const WEIBO_API_PREFIX = 'https://m.weibo.cn/';
const PUBLIC_FILE_PREFIX = 'https://ayk1117.link/static/images/';
const turndownService = new TurndownService();

// Fetch the last 10 post of a user, return the new post ids.
export async function fetchLatestPosts(userId, postDict) {
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
  // Posts to be send to the channel.
  const newPostIds = [];

  // Log failures.
  if (!res.ok || data['ok'] != 1 || data['data'] == undefined) {
    console.log(res.status);
    console.log(JSON.stringify(data));
    return;
  }
  const cards = data['data']['cards'];
  for (const card of cards) {
    const post = new WeiboPost(card);
    if (post.id in postDict) continue;
    newPostIds.push(post.id);
    if (post.isLongText) {
      await populateLongText(post);
    }
    if (post.imageUrls.length != 0) {
      await repopulateImageUrls(post);
    }
    // Format text.
    post.text = generateMessageFromPost(post);
    postDict[post.id] = post;
  }
  return newPostIds;
}

function generateMessageFromPost(post) {
  // Remove all links.
  let message = post.text.replace(/<\/?a[^>]+(>|$)/g, "");
  // HTML to markdown.
  message = turndownService.turndown(message);
  if (post.imageUrls.length > 0) {
    if (post.imageUrls.length <= 3) {
      message = message + '\n' + post.imageUrls.join(' ');
    } else {
      message = message + '\n' + post.imageUrls.slice(0, 3).join(' ')  + ' ' + post.imageUrls.slice(3).join(',\n') + ',';
    }
  }
  return message;
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

async function repopulateImageUrls(weiboPost) {
  const newImageUrls = [];
  for (const imageUrl of weiboPost.imageUrls) {
    const filename = imageUrl.substr(imageUrl.lastIndexOf('/') + 1);
    downloadImage(imageUrl, filename);
    newImageUrls.push(`${PUBLIC_FILE_PREFIX}${filename}`);
  }
  weiboPost.imageUrls = newImageUrls;
}

async function downloadImage(imageUrl, filename) {
  const filepath = `./public/images/${filename}`;
  const res = await fetch(imageUrl);
  if (!res.ok) {
    console.log(res.status);
    console.log(JSON.stringify(data));
  }
  res.body.pipe(fs.createWriteStream(filepath));
}
