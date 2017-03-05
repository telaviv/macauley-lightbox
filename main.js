'use strict';

const fetchJSON = (url) => {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.onload = () => {
      if (request.status >= 200 && request.status < 400) {
        resolve(JSON.parse(request.responseText));
      } else {
        // we won't be actually do any error checking for this mini project
        // it's nice to know how we'd do it though.
        reject(request);
      }
    }
    request.send();
  })
};

const createGiphyURL = (query) => {
  const base =  'http://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&&limit=10&q=';
  const queryParam = query.replace(' ', '+');
  return base + queryParam;
}

const fetchGiphyData = (query) => {
  return fetchJSON(createGiphyURL(query)).then((response) => {
    return response.data.map((data) => ({
      movieUrl: data.images.downsized.url,
      imageUrl: data.images.downsized_still.url,
    }));
  });
};

const loadVideoElement = (url) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.addEventListener('loadeddata', () => resolve(video));
    video.addEventListener('error', reject);
    video.src = url;
  });
};

const loadImageElement = (url) => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.crossOrigin = 'Anonymous';
    image.src = url;
  });
}

const loadImageDataFromElement = (imageElem) => {
  const width = imageElem.naturalWidth;
  const height = imageElem.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  context.drawImage(imageElem, 0, 0);
  return context.getImageData(0, 0, width, height);
}

const averageColor = (imageData) => {
  const sums = {r: 0, g: 0, b: 0 };
  for (let i = 0; i < imageData.data.length; i += 4) {
    sums.r += imageData.data[i];
    sums.g += imageData.data[i + 1];
    sums.b += imageData.data[i + 2];
  }
  const pixelCount = imageData.data.length / 4;
  const r = (sums.r / pixelCount).toFixed(0);
  const g = (sums.g / pixelCount).toFixed(0);
  const b = (sums.b / pixelCount).toFixed(0);
  return `rgb(${r}, ${g}, ${b})`;
}

class GiphyMediaState {
  /* An array of giphy data that async loads over time.

     Displaying a gif in this lightbox design takes two pieces of information

     1) The actual mp4 video to display.
     2) The color to display outside of the video. Derived from a still of the video.

     All in all we will need to load 10 videos and 10 images to derive our color. To
     make this performant we want to load all these images and videos simultaneously.

     GiphyMediaState is a helper class that encapsulates the complexity of a data
     structure that is loading over time. At the heart of the data structure is an
     array of objects with the following properties:

         videoElement - The video element of the gif.
         color - A string that can be a css property value.

     When either of these values are undefined, then the data is not loaded yet.
  */
  constructor(query) {
    this.state = [];
    // note: make 10 a constant;
    for (let i = 0; i < 10; ++i) {
      this.state.push({
        videoElement: { status: 'loading'},
        color: { status: 'loading'},
      });
    }
    this.load(query);
  }

  load(query) {
    fetchGiphyData(query).then((giphyData) => {
      giphyData.forEach(({ movieUrl, imageUrl }, i) => {
        loadVideoElement(movieUrl).then((videoElement) => {
          this.state[i].videoElement = {
            status: 'succeeded',
            el: videoElement,
          };
        }).catch(() => {
          this.state[i].videoElement = { status: 'failed' };
        });
        loadImageElement(imageUrl)
          .then(loadImageDataFromElement)
          .then(averageColor)
          .then((color) => {
            this.state[i].color = {
              status: 'succeeded',
              color,
            };
          }).catch(() => {
            this.state[i].videoElement = { status: 'failed' };
          });
      });
    });
  }
}
