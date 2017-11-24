module.exports = {
    arrayToMap: function arrayToMap(arr) {
        return arr.reduce((result, item) => {
            result[item._id] = item;
            return result;
        }, {});
    },

    mapToArray: function mapToArray(dictionary, itemTransformCallback) {
        return Object.keys(dictionary).reduce(function (result, key){
            const item = itemTransformCallback 
                ? itemTransformCallback(dictionary[key])
                : dictionary[key];
    
            result.push(item);
    
            return result;
        }, []);
    }    
};