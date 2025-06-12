function define(name, value) {
    Object.defineProperty(exports, name, {
        value:      value,
        enumerable: true
    });
}

// Date Filters
define("FILTER_WEEK", 1);
define("FILTER_MONTH", 2);
define("FILTER_CUSTOM", 3);