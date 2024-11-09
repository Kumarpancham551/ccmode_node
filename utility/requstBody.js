
function bodyConverter(data){
    const propertiesToSplit =
   ['shape', 'cut', 'clarity', 'color', 'lab', 'polish', 'fluorescence', 'symmetry', 'fancy_color','fancy_intensity','fancy_overtone'];

    propertiesToSplit.forEach(property => {
        if (data[property] && typeof data[property] === 'string') {
          data[property] = data[property].split(',');
        }
      });
      for(let key in data){
        if(data[key] && !isNaN(data[key])){
          data[key] = parseFloat(data[key])
        }
      }
      return data;
}

module.exports = bodyConverter
