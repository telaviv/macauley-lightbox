const fetchJSON = (url) => {
  return new Promise((resolve, reject) => {
    var request = new XMLHttpRequest();
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
