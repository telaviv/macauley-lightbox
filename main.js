'use strict';

const LEFT_KEY = 37;
const RIGHT_KEY = 39;
const ESC_KEY = 27;

const fetchJSON = (url) => {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.onload = () => {
      if (request.status >= 200 && request.status < 400) {
        resolve(JSON.parse(request.responseText));
      } else {
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
      movieUrl: data.images.downsized_small.mp4,
      imageUrl: data.images.downsized_still.url,
    }));
  });
};

const loadVideoElement = (url) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.addEventListener('loadeddata', () => resolve(video));
    video.addEventListener('error', reject);
    video.autoplay = true;
    video.loop = true;
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
  return `rgba(${r}, ${g}, ${b}, 0.75)`;
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

class OverlayComponent {
  constructor(overlayElem) {
    this.overlayElem = overlayElem;
    this.centerElem = overlayElem.querySelector('.center');
    this.lightboxElem = overlayElem.querySelector('.lightbox');
    this.index = 0;

    document.onkeydown = this.bindKeypresses.bind(this);
  }

  display(mediaState) {
    this.mediaState = mediaState;
    this.updateLightbox();
    this.overlayElem.className = 'overlay show';
  }

  hide() {
    this.overlayElem.className = 'overlay hide';
  }

  bindKeypresses(event) {
    if (event.keyCode == ESC_KEY) {
      this.hide();
    } else if (event.keyCode === LEFT_KEY) {
      this.index = Math.max(0, this.index - 1);
    } else if (event.keyCode === RIGHT_KEY) {
      this.index = Math.min(this.mediaState.state.length - 1, this.index + 1);
    }
    this.updateLightbox();
  }

  updateLightbox() {
    const videoElem = this.mediaState.state[this.index].videoElement;
    const color = this.mediaState.state[this.index].color;
    if (videoElem.status === 'succeeded') {
      this.lightboxElem.innerHTML = '';
      this.lightboxElem.appendChild(videoElem.el);
      videoElem.el.play();
    }
    if (color.status === 'succeeded') {
      this.centerElem.style.backgroundColor = color.color;
    }
  }
}

const GIPHY_GALLERIES = {
  'home alone': new GiphyMediaState('home alone'),
  'my girl': new GiphyMediaState('my girl'),
  'party monster': new GiphyMediaState('party monster'),
}

const OVERLAY = new OverlayComponent(
  document.querySelector('.overlay')
);

document.querySelectorAll('.gallery').forEach((galleryElem) => {
  addEventListener('click', (el) => {
    const gallery = GIPHY_GALLERIES[galleryElem.dataset.query]
    OVERLAY.display(gallery);
    document.querySelector('.wrapper').className = 'wrapper blur';
  })
});
