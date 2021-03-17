/* jshint esversion: 6 */
let finalize;

function updateData() {
  if (finalize) {
    finalize();
    document.getElementById('visualization').innerHTML = '<em class="loading">Loading...</em>';
  }
  const sourceSelector = document.getElementById('source');
  fetch("science-map.vl.json").then((result) => result.json()).then((spec) => {
    sourceSelector.disabled = true;
    return fetch(`data/${sourceSelector.value}.json`).then((result) => result.json()).then((jsonData) => {
      document.getElementById('visualization').innerHTML = '';
      spec.datasets.nodes = jsonData;
      return vegaEmbed("#visualization", spec, { "renderer": "canvas", "actions": true });
    });
  }).then((results) => {
    finalize = results.finalize;
    sourceSelector.disabled = false;
    console.log("Visualization successfully loaded");
  });
}