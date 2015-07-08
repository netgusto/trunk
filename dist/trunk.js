'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var isPromise = function (value) {
    return value instanceof Promise || value !== null && value !== undefined && typeof value === 'object' && 'then' in value && typeof value.then === 'function';
};

var recursivePromises = function (defs) {
    var built = arguments[1] === undefined ? {} : arguments[1];

    var proms = [];

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        var _loop = function () {
            var name = _step.value;

            var def = defs[name];

            if (!def.factoried) {
                if (typeof def.value === 'function') {
                    // calling the factory function
                    var args = def.deps.map(function (depname) {
                        return built[depname];
                    });
                    def.value = def.value.apply(null, args);
                } else {}

                def.factoried = true;
            }

            if (isPromise(def.value)) {
                // it is a promise; we have to hold off resolution until promise is resolved
                return {
                    v: def.value.then(function (resolved) {
                        defs[name].value = resolved;
                        return recursivePromises(defs, built);
                    }).catch(console.log.bind(console))
                };
            } else {
                built[name] = def.value;
            }
        };

        for (var _iterator = Object.keys(defs)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var _ret = _loop();

            if (typeof _ret === 'object') return _ret.v;
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator['return']) {
                _iterator['return']();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    return Promise.resolve(built);
};

function resolveAncestors(graph) {
    var sorted = []; // sorted list of IDs ( returned value )
    var visited = {}; // hash: id of already visited node => true

    // Topological sort algorithm
    /*
        Copyright 2012 Shin Suzuki<shinout310@gmail.com>
         Licensed under the Apache License, Version 2.0 (the "License");
        you may not use this file except in compliance with the License.
        You may obtain a copy of the License at
         http://www.apache.org/licenses/LICENSE-2.0
         Unless required by applicable law or agreed to in writing, software
        distributed under the License is distributed on an "AS IS" BASIS,
        WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
        See the License for the specific language governing permissions and
        limitations under the License.
    */
    /*
        Adapted by Mike Thornton https://gist.github.com/six8/1732686
        Adapted by Jérôme Schneider / Net Gusto https://github.com/netgusto/trunk
    */

    Object.keys(graph).forEach(function visit(name, ancestors) {

        var deps = [];

        if (!(name in graph)) {
            throw new Error('Undefined dependency ' + name + ' on ' + ancestors.join(' -> '));
        }

        if (!Array.isArray(ancestors)) ancestors = [];

        ancestors.push(name);
        visited[name] = true;

        graph[name].deps.forEach(function (dep) {
            if (ancestors.indexOf(dep) >= 0) {
                throw new Error('Circular dependency "' + dep + '" is required by "' + name + '": ' + ancestors.join(' -> '));
            } // if already in ancestors, a closed chain exists.

            // if already exists, do nothing
            if (visited[dep]) {
                return;
            }

            visit(dep, ancestors.slice(0)); // recursive call
        });

        if (sorted.indexOf(name) < 0) sorted.push(name);
    });

    return sorted;
};

var _compile = function (graph) {

    var resolved = resolveAncestors(graph);

    var promises = [];
    var definitions = {};

    // Flattening definitions
    resolved.forEach(function (name) {
        var definition = graph[name];

        if (typeof definition.factory !== 'function') {
            throw new Error('Dependencies should always be wrapped in functions. Check the definition of ' + name);
        } else {
            definitions[name] = { name: definition.name, deps: definition.deps, value: definition.factory, factoried: false };
        }
    });

    return new Promise(function (resolve) {
        recursivePromises(definitions).then(function (built) {
            resolve(built);
        }).catch(function (e) {
            return console.log(e.stack);
        });
    });
};

var serviceDefinitionsSymbol = Symbol();
var servicesSymbol = Symbol();

var Trunk = (function () {
    function Trunk() {
        _classCallCheck(this, Trunk);

        this[serviceDefinitionsSymbol] = {};
        this[servicesSymbol] = {};
        this.compiled = false;
    }

    _createClass(Trunk, [{
        key: 'open',
        value: function open() {
            return this.compile.apply(this, arguments);
        }
    }, {
        key: 'compile',
        value: function compile() {
            var _this = this;

            return new Promise(function (resolve) {
                _compile(_this[serviceDefinitionsSymbol]).then(function (services) {
                    _this[servicesSymbol] = services;
                    _this.compiled = true;
                    resolve(_this);
                }).catch(function (e) {
                    return console.log(e.stack);
                });
            });
        }
    }, {
        key: 'add',
        value: function add() {
            return this.service.apply(this, arguments);
        }
    }, {
        key: 'get',
        value: function get(name) {
            return this.service(name);
        }
    }, {
        key: 'service',
        value: function service(name, deps) {
            var factory = arguments[2] === undefined ? null : arguments[2];

            if (deps === undefined) {

                // called only with the name
                if (name in this.services) {
                    return this.services[name];
                } else {
                    throw new Error('Service ' + name + ' undefined.');
                }
            }

            if (this.compiled) {
                throw new Error('Cannot add service, application is compiled.');
            }

            if (typeof deps === 'function') {
                factory = deps;
                deps = [];
            }

            if (!Array.isArray(deps)) {
                throw new Error('Service dependencies must be defined in an array, or omitted. Check the definition of ' + name + '.');
            }

            if (typeof factory !== 'function') {
                throw new Error('Service must always be wrapped in a factory function. Check the definition of ' + name + '.');
            }

            this[serviceDefinitionsSymbol][name] = { name: name, deps: deps, factory: factory };
            return this;
        }
    }, {
        key: 'koa',
        value: function koa() {

            // creating proxy object !
            var trunk = {};
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
                for (var _iterator2 = Object.keys(this.services)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                    var _name = _step2.value;

                    trunk[_name] = this.service(_name);
                }
            } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion2 && _iterator2['return']) {
                        _iterator2['return']();
                    }
                } finally {
                    if (_didIteratorError2) {
                        throw _iteratorError2;
                    }
                }
            }

            return trunk;
        }
    }, {
        key: 'services',
        get: function () {
            if (!this.compiled) {
                throw new Error('Application not compiled !');
            }

            return this[servicesSymbol];
        }
    }]);

    return Trunk;
})();

exports.default = { Trunk: Trunk };
module.exports = exports.default;

// if not a function, nothing to be factoried !

