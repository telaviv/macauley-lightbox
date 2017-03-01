'use strict';

const fetchJSON = (url) => {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
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
      movie: data.images.looping.mp4,
      image: data.images.downsized_still.url,
    }));
  });
};

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
  constructor() {
    this.state = [];
    // note: make 10 a constant;
    for (let i = 0; i < 10; ++i) {
      this.state.push({});
    }
  }

  load(query) {
    // Load the giphy query into the GiphyMediaState
    //
    // It's a bit odd to have what is essentially the second part of the constructor be a
    // second method. It's also weird to have a constructor with a side effect of making
    // 20 requests.

    fetchGiphyData(query);
    return this;
  }
}
