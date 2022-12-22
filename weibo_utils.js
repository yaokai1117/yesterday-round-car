export class WeiboPost {
  constructor(cardJson) {
    const mblog = cardJson['mblog'];
    this.id = mblog['id'];
    this.isLongText = mblog['isLongText'];
    this.text = mblog['text'];
    this.imageUrls = [];

    const pics = mblog['pics'];
    if (pics != undefined && pics.length > 0) {
      for (const pic of pics) {
        this.imageUrls.push(pic['large']['url']);
      }
    }

    // Handle the case of retweet
    this.isRetweet = mblog['retweeted_status'] != undefined;
    if (this.isRetweet) {
      const retweet = mblog['retweeted_status']
      this.text = retweet['text'];
      this.imageUrls = [];
      const retweetPics = retweet['pics'];
      if (retweetPics != undefined && retweetPics.length > 0) {
        this.imageUrls = [];
        for (const pic of retweetPics) {
          this.imageUrls.push(pic['large']['url']);
        }
      }
    }
  }
}
