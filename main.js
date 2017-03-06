'use strict';

const LEFT_KEY = 37;
const RIGHT_KEY = 39;
const ESC_KEY = 27;

const fetchJSON = (url) => {
  /* Perform a get request to fetch parsed json.

     Args:
        url - { string }

     Returns: { promise }
        resolve - { object } - the parsed json blob
        reject - { XMLHTTPRequest }
  */
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

const createGiphyURL = (query, count) => {
  /* Creates a giphy url to fetch data.

     Args:
         query - a space seperated string to search for gifs on giphy
         count - the amount of gifs to search for.

     Returns: { string }

   */
  const base =  'http://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&';
  const limitParam = 'limit=' + count;
  const queryParam = 'q=' + query.replace(' ', '+');
  return base + limitParam + '&' + queryParam;
}

const fetchGiphyData = (query, count) => {
  /* Fetches giphy data.

     Args:
         query - a space seperated string to search for gifs on giphy
         count - the amount of gifs to search for.

     Returns: { promise }
         resolve - { object } - giphy data
         reject - { XMLHTTPRequest }
   */
  return fetchJSON(createGiphyURL(query, count)).then((response) => {
    return response.data.map((data) => ({
      movieUrl: data.images.original.mp4,
      imageUrl: data.images.downsized_still.url,
    }));
  });
};

const loadVideoElement = (url) => {
  /* Creates a video element with a preloaded url.

     Args:
         url - a video url.

     Returns: { promise }
         resolve - { video } - A preloaded video.
   */
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
  /* Creates an image element with a preloaded url.

     Args:
         url - an image url.

     Returns: { promise }
         resolve - { image } - A preloaded image.
   */
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.crossOrigin = 'Anonymous';
    image.src = url;
  });
}

const loadImageDataFromElement = (imageElem) => {
  /* Finds the ImageData of an image element.

     Args:
         imageElem - an image element.

     Returns: { ImageData }
   */
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
  /* Finds the average color of an image. We also add some transparency
     to the color.

     Args:
         imageData - { ImageData }

     Returns: { string } - a color to be used as a css property.
   */
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

class GalleryState {
  /* An array of giphy data that async loads over time.

     Displaying a gif in this lightbox design takes two pieces of information

     1) The actual mp4 video to display.
     2) The color to display outside of the video. Derived from a still of the video.

     All in all we will need to load a lot of images and videos to derive our color. To
     make this performant we want to load all these images and videos simultaneously.

     GalleryState is a helper class that encapsulates the complexity of a data
     structure that is loading over time. At the heart of the class is the "state"
     property which is an array of media objects with the following properties:

         videoElement
             status - loading, succeeded, or failed
             value - A video element.
         color
             status - loading, succeeded, or failed
             value - A string that can be used as a color property. It's a transparent
                 color derived from a still of the video.

     You can also add a listener with the "addListener" method. This will be notified
     as the status of the videoElement changes.
  */
  constructor(query, count) {
    this.updateListener = () => {};
    this.state = [];
    for (let i = 0; i < count; ++i) {
      this.state.push({
        videoElement: { status: 'loading'},
        color: { status: 'loading'},
      });
    }
    this.load(query, count);
  }

  addListener(listener) {
    this.updateListener = listener;
  }

  removeListener() {
    this.updateListener = () => {};
  }

  load(query, count) {
    fetchGiphyData(query, count).then((giphyData) => {
      giphyData.forEach(({ movieUrl, imageUrl }, i) => {
        this.loadVideoElement(movieUrl, i);
        this.loadImageElement(imageUrl, i);
      });
    });
  }

  loadVideoElement(movieUrl, index) {
    loadVideoElement(movieUrl).then((videoElement) => {
      this.state[index].videoElement = {
        status: 'succeeded',
        value: videoElement,
      };
      this.updateListener(index);
    }).catch(() => {
      this.updateListener(index);
      this.state[index].videoElement = { status: 'failed' };
    });
  }

  loadImageElement(imageUrl, index) {
    loadImageElement(imageUrl)
      .then(loadImageDataFromElement)
      .then(averageColor)
      .then((color) => {
        this.state[index].color = {
          status: 'succeeded',
          value: color,
        };
      }).catch(() => {
        this.state[index].videoElement = { status: 'failed' };
      });
  }
}

class OverlayComponent {
  /*
     Manages the full page overlay and lightbox.

     public methods:
         displayLightbox - display a gallery in the lightbox.
         hide - hide the overlay.

     public property:
         hideListener - callback that's notified when hiding.
  */

  constructor(overlayElem) {
    this.overlayElem = overlayElem;
    this.centerElem = overlayElem.querySelector('.center');
    this.lightboxElem = overlayElem.querySelector('.lightbox');
    this.index = 0;
    this.hideListener = () => {};

    document.onkeydown = this.bindKeypresses.bind(this);
  }

  displayLightbox(galleryState, loadingSrc) {
    /*
       Displays a gallery in the lightbox.

       Args:
           galleryState - an instance of GalleryState.
           loadingSrc - the url of an image to show while loading.
    */
    if (this.galleryState) {
      this.galleryState.removeListener();
    }
    this.galleryState = galleryState;
    this.galleryState.addListener(this.onGalleryUpdate.bind(this));

    this.loadingSrc = loadingSrc;
    this.index = 0;
    this.updateLightbox();
    this.overlayElem.className = 'overlay show';
  }

  onGalleryUpdate(index) {
    if (index === this.index) {
      this.updateLightbox();
    }
  }

  hide() {
    /*
       Hide the overlay.
    */
    this.overlayElem.className = 'overlay hide';
    this.hideListener();
  }

  bindKeypresses(event) {
    if (event.keyCode == ESC_KEY) {
      this.hide();
    } else if (event.keyCode === LEFT_KEY) {
      if (this.index === 0) {
        this.hide();
      } else {
        this.index = this.index - 1;
      }
    } else if (event.keyCode === RIGHT_KEY) {
      if (this.index === this.galleryState.state.length - 1) {
        this.hide();
      } else {
        this.index = this.index + 1;
      }
    }
    this.updateLightbox();
  }

  updateLightbox() {
    const videoElem = this.galleryState.state[this.index].videoElement;
    const color = this.galleryState.state[this.index].color;
    this.lightboxElem.innerHTML = '';
    if (videoElem.status === 'succeeded') {
      this.lightboxElem.appendChild(videoElem.value);
      // removing elements has a side effect of pausing them.
      videoElem.value.play();
    } else if (videoElem.status === 'failed') {
      this.lightboxElem.appendChild(this.failureElement());
    } else if (videoElem.status === 'loading') {
      this.lightboxElem.appendChild(this.loadingElement());
    }

    if (color.status === 'succeeded') {
      this.centerElem.style.backgroundColor = color.value;
    }
  }

  failureElement() {
    const pElem = document.createElement('p');
    pElem.className = 'message';
    pElem.innerText = 'Sorry something wen\'t wrong :('
    return pElem
  }

  loadingElement() {
    const divElem = document.createElement('div');
    const pElem = document.createElement('p');
    pElem.innerText = 'loading ...'
    const image = new Image()
    image.src = this.loadingSrc;
    divElem.className = 'message';
    divElem.appendChild(image);
    divElem.appendChild(pElem);
    return divElem;
  }
}

const GIPHY_GALLERIES = {
  'home alone': new GalleryState('home alone', 10),
  'my girl': new GalleryState('my girl', 4),
  'party monster': new GalleryState('party monster', 6),
}

const OVERLAY = new OverlayComponent(document.querySelector('.overlay'));

OVERLAY.hideListener = () => {
  document.querySelector('.wrapper').className = 'wrapper';
}

document.querySelectorAll('.gallery').forEach(() => {
  addEventListener('click', (event) => {
    if (!(event.target.parentElement &&
          event.target.parentElement.dataset.query)) {
      return;
    }
    const gallery = GIPHY_GALLERIES[event.target.parentElement.dataset.query];
    const loader = event.target.parentElement.dataset.loader;
    OVERLAY.displayLightbox(gallery, loader);
    document.querySelector('.wrapper').className = 'wrapper blur';
  })
});
