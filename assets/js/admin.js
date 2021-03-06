/**
 * JS for models in admin dashboard
 * 
 * @author Jared King <j@jaredtking.com>
 * @link http://jaredtking.com
 * @version 1.0
 * @copyright 2013 Jared King
 * @license MIT
	Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
	associated documentation files (the "Software"), to deal in the Software without restriction,
	including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
	and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
	subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all copies or
	substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
	LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
	IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
	WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
	SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

var app = angular.module('models', ['ngResource','ngRoute','ngSanitize','ui.bootstrap','ui.date']);

app.factory('Model', ['$resource', function ($resource) {
	var Model = $resource(
		'/api/' + module + '/' + modelInfo.plural_key + '/:modelId',
		{ modelId : '@modelId' },
		{
			findAll: { method: 'GET', headers: { Accept: 'application/json'} },
			find: { method: 'GET', headers: { Accept: 'application/json'} },
			delete: { method: 'DELETE', headers: { Accept: 'application/json'} },
			edit: { method: 'PUT', headers: { Accept: 'application/json'} },
			create: { method: 'POST', headers: { Accept: 'application/json'} }
		}
	);
	
	return Model;
}]);

app.config(['$routeProvider',function($routeProvider) {
		$routeProvider.
		when('/', {
			controller: ModelCntl,
			templateUrl: '/templates/admin/models.html'
		}).
		when('/new', {
			controller: ModelCntl,
			templateUrl: '/templates/admin/editModel.html'
		}).
		when('/:id', {
			controller: ModelCntl,
			templateUrl: '/templates/admin/model.html'
		}).
		when('/:id/edit', {
			controller: ModelCntl,
			templateUrl: '/templates/admin/editModel.html'
		}).
		otherwise({redirectTo:'/'});
}]);

/* Directives */

app.directive('eatClick', function() {
    return function(scope, element, attrs) {
        $(element).click(function(event) {
            event.preventDefault();
        });
    };
});

app.directive('expandingTextarea', function() {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
       		$(element).expandingTextarea();
       		
       		scope.$watch(attrs.ngModel, function (v) {
       			$(element).expandingTextarea('resize');
       		});
        }
    };
});

app.directive('jsonEditor', ['$parse', function($parse) {
    return {
        restrict: 'A',
        require: 'ngModel',
        link: function (scope, element, attrs, ngModel) {
        	var model = $parse(attrs.ngModel);

        	var opt = {
        		change: function(data) {
        			scope.$apply(function() {
        				ngModel.$setViewValue(data);
        			});
        		}
        	};
       		
       		scope.$watch(model, function (data) {
       			if (typeof data != 'object')
       				return;

       			$(element).jsonEditor(data, opt);
       		});
        }
    };
}]);

/* Filters */

app.filter('modelValue', function() {
	return function (model, properties, property, truncate) {
		
		// apply admin html
		if (typeof(property.admin_html) == 'string')
		{
			value = property.admin_html;
			
			for (var i in properties)
			{
				// replace placeholders with values
				var search = '{' + properties[i].name + '}';
				
				if (value.indexOf(search) != -1)
					value = value.replace(
						new RegExp(search, "g"),
						parseModelValue(model, properties[i], truncate));
			}
			
			return value;
		}
		// no admin html
		else
			return parseModelValue(model, property, truncate);
	};
});

/* Controllers */

var ModelCntl = ['$scope', '$routeParams', '$location', '$modal', 'Model',
	function($scope, $routeParams, $location, $modal, Model) {
		
		$scope.module = module;
		$scope.modelInfo = modelInfo;
		$scope.page = 1;
		$scope.limit = 10;	
		$scope.deleteModel = false;
		$scope.models = [];
		$scope.loading = false;
		$scope.sort = [];
		$scope.sortStates = {'0':'1','1':'-1','-1':'0'};
		$scope.sortMap = {'1':'asc','-1':'desc'};
		$scope.filter = {};
		$scope.hasFilter = {};
		$scope.visibleProperties = {};
		$scope.datepickerOptions = {
			dateFormat: 'M d, yy'
		};
		// O(N^2)...
		for (var i in $scope.modelInfo.properties) {
			var property = $scope.modelInfo.properties[i].name;
			var found = false;
			for (var j in $scope.modelInfo.visibleProperties) {
				if ($scope.modelInfo.visibleProperties[j].name == property) {
					found = true;
					break;
				}
			}
			$scope.visibleProperties[property] = found;
		}

		$scope.loadModels = function(keepPage) {
			if (!keepPage)
				$scope.page = 1;

			var start = ($scope.page - 1) * $scope.limit;
		
			$scope.loading = true;
			
			var params = {
				search: $scope.query,
				start: start,
				limit: $scope.limit
			};
			
			// convert $scope.sort array into a properly formatted string
			var sorted = [];
			for (var i in $scope.sort)
				sorted.push($scope.sort[i].name + ' ' + $scope.sortMap[$scope.sort[i].direction]);
			params.sort = sorted.join(',');
			
			// find out which properties are filtered
			for (var i in $scope.hasFilter) {
				if ($scope.hasFilter[i] && $scope.filter[i])
					params['filter[' + i + ']'] = $scope.filter[i];
			}
		
			Model.findAll(params, function(result) {
			
				$scope.filtered_count = result.filtered_count,
				$scope.links = result.links,
				$scope.page = result.page,
				$scope.page_count = result.page_count,
				$scope.per_page = result.per_page,
				$scope.total_count = result.total_count
				
				$scope.models = result[$scope.modelInfo.plural_key];
				
				// massage data for client side use
				for (var i in $scope.models)
					massageModelForClient ($scope.models[i], $scope.modelInfo);
				
				$scope.loading = false;
				
			}, function(error) {
			
				$scope.loading = false;
				
			});
		};

		$scope.noModels = function() {
			if ($scope.models.length > 0)
				return false;

			for (var i in $scope.hasFilter)
			{
				if ($scope.hasFilter[i])
					return false;
			}

			return true;
		};

		$scope.toggleVisibility = function(property) {
			if ($scope.visibleProperties[property.name]) {
				$scope.modelInfo.visibleProperties.push(property);
			} else {
				for (var i in $scope.modelInfo.visibleProperties) {
					if ($scope.modelInfo.visibleProperties[i].name == property.name) {
						$scope.modelInfo.visibleProperties.splice(i, 1);
						break;
					}
				}
			}
		}
		
		$scope.sortDirection = function(property) {
			for (var i in $scope.sort) {
				if ($scope.sort[i].name == property.name)
					return $scope.sort[i].direction;
			}
			
			return 0;
		};
		
		$scope.toggleSort = function(property) {
			var current = $scope.sortDirection(property);
			
			// add to the sort list
			var nextState = $scope.sortStates[current];
			
			if (current == 0)
				$scope.sort.push({name:property.name, direction:nextState});
			else
			{
				// find the index of the property
				var index = -1;
				for (var i in $scope.sort) {
					if ($scope.sort[i].name == property.name) {
						index = i;
						break;
					}
				}
				
				// remove
				if (nextState == 0)
					$scope.sort.splice(index, 1);
				// update
				else
					$scope.sort[index].direction = nextState;
			}
			
			$scope.loadModels();
		};
		
		$scope.showFilter = function(property) {
			$scope.hasFilter[property.name] = true;
			$scope.loadModels();
		};
		
		$scope.hideFilter = function(property) {
			$scope.hasFilter[property.name] = false;
			$scope.loadModels();
		};
			
		$scope.currentPages = function(n) {
			var pages = [];
			
			var i = 0;
			var start = $scope.page - Math.floor(n/2);
			
			if ($scope.page_count - $scope.page < Math.floor(n/2))
				start -= Math.floor(n/2) - ($scope.page_count - $scope.page);
			
			start = Math.max(start, 1);
			
			var p = start;
	
			while (i < n && p <= $scope.page_count) {
				pages.push(p);
				i++;
				p++;
			}
			
			return pages;
		};
		
		$scope.prevPage = function() {
			$scope.goToPage($scope.page-1);
		};
		
		$scope.nextPage = function() {
			$scope.goToPage($scope.page+1);
		};
		
		$scope.goToPage = function(p) {
			if (p < 1 || p > $scope.page_count)
				return;
			
			if ($scope.page != p) {
				$scope.page = p;
				$scope.loadModels(true);
			}
		};
		
		$scope.findModel = function(id) {
			$scope.loading = false;
			
			Model.find({
				modelId: id
			}, function (result) {
			
				$scope.model = result[$scope.modelInfo.singular_key];
				
				// the model needs to be massaged
				massageModelForClient ($scope.model, $scope.modelInfo);
				
				$scope.loading = true;
				
			}, function(error) {
			
				if (error.status == 404)
					$location.path('/');

				$scope.loading = false;

			});
		};
		
		$scope.deleteModelAsk = function(model) {
			$scope.deleteModel = model;

			var modalInstance = $modal.open({
				controller: DeleteModalCntl,
				resolve: {
					modelInfo: function() {
						return $scope.modelInfo;
					}
				},
				templateUrl: '/templates/admin/deleteModalAsk.html'
			});

			modalInstance.result.then(
				$scope.deleteModelConfirm,
				function() {
					$scope.deleteModel = false;
				});
		};
		
		$scope.deleteModelConfirm = function() {
			
			Model.delete({
				modelId: $scope.deleteModel.id
			}, function(result) {
				if (result.error) {
	    			$scope.errors = result.error;
				} else {
					if ($routeParams.id)
						$location.path('/');
					else
						$scope.loadModels(true);
				}
			}, function(result) {
				// TODO handle 401 and 403 errors
			});
			
			$scope.deleteModel = false;
		}
		
		$scope.saveModel = function() {
		
			$scope.saving = true;
			
			var modelData = clone($scope.model);
			
			// some properties need massaging before being sent to the server
			massageModelForServer(modelData, $scope.modelInfo.properties);

			//console.log(modelData);
			
			if ($scope.newModel) {

				Model.create(modelData, function(result) {
					$scope.saving = false;
					
					//console.log(result);
	
		    		if (result.success) {
		    			$location.path('/');
					} else if (result.error && result.error instanceof Array) {
		    			$scope.errors = result.error;
		    		}
				});
				
			} else {
			
				modelData.modelId = $scope.model.id;
			
				Model.edit(modelData, function(result) {
					$scope.saving = false;
					
					//console.log(result);
	
		    		if (result.success) {
		    			$location.path('/' + modelData.id);
					} else if (result.error && result.error instanceof Array) {
		    			$scope.errors = result.error;
		    		}
				});
			
			}
			
		};
		
		if( $routeParams.id )
		{
			$scope.findModel($routeParams.id);
		}
		else
		{
			// new model
			if ($location.$$path.indexOf('/new') !== -1) {
				$scope.newModel = true;
				
				$scope.model = {};
				
				// setup default values
				for (var i in $scope.modelInfo.properties) {
					var property = $scope.modelInfo.properties[i];
					
					$scope.model[property.name] = (typeof property.default != 'undefined') ? property.default : '';
					
					// enums cannot have an empty value, grab first value
					if (property.admin_type == 'enum' && typeof property.default == 'undefined') {
						var kyz = Object.keys(property.admin_enum);
						$scope.model[property.name] = property.admin_enum[kyz[0]];
					}
				}
				
				// the model needs to be massaged
				massageModelForClient ($scope.model, $scope.modelInfo);
			
			// browsing all models
			} else {
				$scope.loadModels();
			}
		}
}];

var DeleteModalCntl = ['$scope','$modalInstance','modelInfo',
	function($scope, $modalInstance, modelInfo) {

	$scope.modelInfo = modelInfo;

	$scope.ok = function() {
		$modalInstance.close();
	};

	$scope.cancel = function() {
		$modalInstance.dismiss('cancel');
	};
}];

/* Helper Functions */

function nl2br(input) {
	return (input + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br />$2');
}

function htmlentities(str) {
	return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseModelValue (model, property, truncate) {

	if (typeof model == 'undefined')
		return '';
	
	var value = '';
	
	if (typeof model[property.name] != 'undefined')
		value = model[property.name];
	else if (property.default)
		value = property.default;
	
	if (value === null)
		return '<em>null</em>';

	switch(property.admin_type)
	{
	case 'text':
	case 'textarea':
	break;
	case 'checkbox':
		value = (value > 0) ? 'Yes' : 'No';
	break;
	case 'datepicker':
		if (value != null)
			value = moment(value).format("MMM D, YYYY h:mm a");
	break;
	case 'enum':
		if (property.admin_enum)
		{
			if (property.admin_enum[value])
				value = property.admin_enum[value];
			else if (property.default)
				value = property.admin_enum[property.default];
		}		
	break;
	case 'password':
		return '<em>hidden</em>';
	break;
	case 'json':
		value = JSON.stringify(value);
	break;
	case 'html':
		return value;
	break;
	}
	
	// truncation
	if (truncate && property.admin_truncate && value.length > 40)
		value = value.substring(0, 40) + '...';
	
	// convert new lines to breaks and escape html characters
	value = nl2br(htmlentities(value));

	// link relationships
	if (property.relation) {
		var pieces = property.relation.split('\\');
		var module = pieces[2];
		var model = pieces[4];
		value = '<a href="/admin/' + module + '/' + model + '#/' + value + '">' + value + '</a>';
	}

	return value;
}

function massageModelForClient (model, modelInfo) {

	for (var i in modelInfo.properties) {
		var property = modelInfo.properties[i];
		var value = model[property.name];
		
		switch (property.admin_type)
		{
		case 'datepicker':
			if (value == 0)
				model[property.name] = null;
			else
				model[property.name] = moment.unix(value).toDate();
		break;
		case 'password':
			model[property.name] = '';
		break;
		case 'checkbox':
			model[property.name] = (value > 0) ? true : false;
		break;
		}
	}
	
	// multiple ids
	if (angular.isArray(modelInfo.idProperty))
	{
		var ids = [];
		
		for (var i in modelInfo.idProperty)
		{
			if (model[modelInfo.idProperty[i]] === '')
			{
				ids = false;
				break;
			}
			
			ids.push(model[modelInfo.idProperty[i]]);
		}
					
		if (ids)
			model.id = ids.join(',');
	}
	// single id
	else
		model.id = model[modelInfo.idProperty];			
}

function massageModelForServer (model, properties) {

	for (var i in properties) {
		var property = properties[i];
		var value = model[property.name];
	
		switch (property.admin_type)
		{
		case 'datepicker':
			if (value != null)
				model[property.name] = moment(value).unix();
			else if (typeof property.null == 'undefined' || !property.null)
				model[property.name] = 0;
			else
				model[property.name] = null;
		break;
		case 'password':
			if (value.length == 0)
				delete model[property.name];
		break;
		}
	}

}

// props to http://my.opera.com/GreyWyvern/blog/show.dml/1725165

function clone(obj) {
    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        var copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        var copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        var copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}