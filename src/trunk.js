'use strict';

const isPromise = function(value) {
    return value instanceof Promise || (value !== null && value !== undefined && typeof value === 'object' && 'then' in value && typeof value.then === 'function');
};

const recursivePromises = function(defs, built = {}) {

    let proms = [];

    for(let name of Object.keys(defs)) {

        let def = defs[name];

        if(!def.factoried) {
            if(typeof def.value === 'function') {
                // calling the factory function
                let args = def.deps.map(function(depname) { return built[depname]; });
                def.value = def.value.apply(null, args);
            } else {
                // if not a function, nothing to be factoried !
            }

            def.factoried = true;
        }

        if(isPromise(def.value)) {
            // it is a promise; we have to hold off resolution until promise is resolved
            return def.value.then(function(resolved) {
                defs[name].value = resolved;
                return recursivePromises(defs, built);
            }).catch(console.log.bind(console));
        } else {
            built[name] = def.value;
        }
    }

    return Promise.resolve(built);
};

function resolveAncestors(graph) {
    var sorted  = []; // sorted list of IDs ( returned value )
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

        if(!(name in graph)) {
            throw new Error('Undefined dependency ' + name + ' on ' + ancestors.join(' -> '));
        }

        if(!Array.isArray(ancestors)) ancestors = [];

        ancestors.push(name);
        visited[name] = true;

        graph[name].deps.forEach(function(dep) {
            if (ancestors.indexOf(dep) >= 0) {
                throw new Error('Circular dependency "' +  dep + '" is required by "' + name + '": ' + ancestors.join(' -> '));
            }  // if already in ancestors, a closed chain exists.

            // if already exists, do nothing
            if (visited[dep]) { return; }

            visit(dep, ancestors.slice(0)); // recursive call
        });

        if(sorted.indexOf(name)<0) sorted.push(name);
    });

    return sorted;
};

const compile = function(graph) {

    let resolved = resolveAncestors(graph);

    let promises = [];
    let definitions = {};

    // Flattening definitions
    resolved.forEach(function(name) {
        var definition = graph[name];

        if(typeof definition.factory !== 'function') {
            throw new Error('Dependencies should always be wrapped in functions. Check the definition of ' + name);
        } else {
            definitions[name] = { name: definition.name, deps: definition.deps, value: definition.factory, factoried: false };
        }
    });

    return new Promise(resolve => {
        recursivePromises(definitions).then(function(built) {
            resolve(built);
        }).catch(e => console.log(e.stack));
    });
};

const serviceDefinitionsSymbol = Symbol();
const servicesSymbol = Symbol();

class Trunk {

    constructor() {
        this[serviceDefinitionsSymbol] = {};
        this[servicesSymbol] = {};
        this.compiled = false;
    }

    open(...args) { return this.compile(...args); }

    compile() {
        return new Promise(resolve => {
            compile(this[serviceDefinitionsSymbol]).then(services => {
                this[servicesSymbol] = services;
                this.compiled = true;
                resolve(this);
            }).catch(e => console.log(e.stack));
        });
    }

    get services() {
        if(!this.compiled) {
            throw new Error('Application not compiled !');
        }

        return this[servicesSymbol];
    }

    add(...args) {
        return this.service(...args);
    }

    get(name) { return this.service(name); }

    service(name, deps, factory = null) {
        if(deps === undefined) {

            // called only with the name
            if(name in this.services) {
                return this.services[name];
            } else {
                throw new Error('Service ' + name + ' undefined.');
            }
        }

        if(this.compiled) {
            throw new Error('Cannot add service, application is compiled.');
        }

        if(typeof deps === 'function') {
            factory = deps;
            deps = [];
        }

        if(!Array.isArray(deps)) {
            throw new Error('Service dependencies must be defined in an array, or omitted. Check the definition of ' + name + '.');
        }

        if(typeof factory !== 'function') {
            throw new Error('Service must always be wrapped in a factory function. Check the definition of ' + name + '.');
        }

        this[serviceDefinitionsSymbol][name] = { name, deps, factory };
        return this;
    }

    koa() {

        // creating proxy object !
        const trunk = {};
        for(let name of Object.keys(this.services)) {
            trunk[name] = this.service(name);
        }

        return trunk;
    }
}

export default { Trunk };