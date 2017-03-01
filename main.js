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
  const base =  'http://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=';
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
