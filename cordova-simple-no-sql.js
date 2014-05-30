var SimpleNoSQL = SimpleNoSQL || {};


(function(SimpleNoSQL, window) {

  // INTERNAL
  var collections = [];

  var isOpened = false;

  var fs, dbFile, savedPath;

  /*
   * Timeout used to delay the save in case of multiple save in same time
   */
  var saveTimeout, timeoutCallbacks = [];

  function openDB(path, success, fail) {
    window.requestFileSystem(window.LocalFileSystem.PERSISTENT, 0, function( fileSystem ) {
        fs = fileSystem;

        fs.root.getFile( path, {create: true, exclusive: false},
          function( fileEntry ) {
            dbFile = fileEntry;

            if( success ) {
              success.call( this, dbFile );
            }
          },
          function( error ) {
//                    console.log( error );
            if( fail ) {
              fail.call(this, "[SimpleNOSQL] Error on getting DB File for path " + path);
            }
          }
        );
      },
      function(error) {
//            console.log( error );
        if( fail ) {
          fail.call(this, "[SimpleNOSQL] Error on getting persistent filesystem for path " + path );
        }
      });
  };

  function closeDB() {

    fs = undefined;
    dbFile = undefined;

    isOpened = false;
  };

  function search( collectionName, query ) {

    // If the query is undefined, assign an empty object
    query = query || {};

    var results = [];
    var queryKeys = Object.keys(query);

    // Iterate through datas
    for( var i = 0; i < collections.length; i++ ) {

      if( collections[i].value == collectionName ) {
        var datas = collections[i].datas;

        if (typeof datas == 'object')
          results = datas;
        else {
          for( var j = 0; j < datas.length; j++ ) {
            var entry = datas[j];
            var found = true;

            for( var k = 0; k < queryKeys.length && found; k++ ) {
              var key = queryKeys[k];

              if( entry.hasOwnProperty( key ) == false ) {
                // entry have not the searched key, so avoid to next entry
                found = false;
              }
              else if( entry[key] != query[key] ) {
                found = false;
              }
            }

            if( found ) {
              results.push( entry );
            }
          }
        }
      }
    }

    return results;
  }



  /**
   * Indicate if available. If true, indicates if stored as localstorage or file
   * If localStorage, it will follow browser size limit specifications
   * @returns {boolean} Indicates if cordova / phonegap is launched
   */
  SimpleNoSQL.getAvailability = function() {
    var storedAsFile = window.cordova!=undefined,
      available = window.cordova!=undefined || typeof(Storage)!=="undefined";

    return {
      storedAsFile: storedAsFile,
      available: available
    };
  };

  /**
   *
   * @param path
   * @returns {*}
   */
  SimpleNoSQL.loadDB = function(path, callback) {
    if( path == undefined || path.length == 0 ) {
      if( callback ) {
        callback.call( this, {
          result: false,
          msg: "A path is required"
        });
      }

      return;
    }

    if( isOpened ) {
      if( callback ) {
        callback.call( this, {
          result: false,
          msg: "A DB is already opened, please close it before loading another one."
        });
      }

      return;
    }


    savedPath = path;


    var availability = SimpleNoSQL.getAvailability();

    if( availability.available ) {
      if( availability.storedAsFile ) {
//                console.log("opendb as file");
        // Open via files
        openDB( path,
          function( entry ) {
//                        console.log( "db is opened" );
            // Read file as text
            entry.file(function(file) {
                var reader = new FileReader();
                reader.onloadend = function(evt) {
                  //                            console.log( "Datas has been read");
                  if( evt.target.result ) {
                    try {
                      collections = JSON.parse( evt.target.result );
                    }
                    catch(err) {
                      console.log(err);
                    }
                  }

                  if( callback ) {
                    callback.call(this, collections);
                  }

                  isOpened = true;
                };

                reader.onerror = function(evt) {
                  //                            console.log( "[SimpleNOSQL] Error on loading file data at path " + path );
                  if( callback ) {
                    callback.call( this, {
                      result: false,
                      error: "[SimpleNOSQL] Error on loading file data at path " + path
                    } );
                  }
                };
                reader.readAsText(file);
              },
              function(error) {
                if( callback ) {
                  callback.call( this, {
                    result: false,
                    error: error
                  } );
                }
              });
          },
          function( error ) {
            if( callback ) {
              callback.call( this, {
                result: false,
                error: error
              } );
            }
          }
        );
      }
      else {
        // Load from localStorage
        var storedDatas = window.localStorage.getItem(path);

        if( storedDatas != undefined && storedDatas != null ) {
          collections = JSON.parse( storedDatas );
        }

        isOpened = true;

        if( callback ) {
          callback.call(this, collections);
        }

      }
    }
    else {
      callback.call(this, collections);
    }
  };

  /**
   *
   * @param collectionName Name of the collection
   * @param query query that must match
   * @returns {Array}
   */
  SimpleNoSQL.query = function( collectionName, query ) {
    return search( collectionName, query );
  };

  /**
   *
   * @param collectionName Name of the collection
   * @param query query that must match
   * @returns {Object}
   */
  SimpleNoSQL.get = function( collectionName, query ) {
    var results = search( collectionName, query );

    if( results.length > 0 )
      return results[0];

    return undefined;
  };


  /**
   *
   * @param collectionName Name of the collection
   * @param entry Entry to add into the collection
   * @param callback Callback for success or error
   */
  SimpleNoSQL.addEntry = function( collectionName, entry, callback ) {
    if( !isOpened ) {
      if( callback ) {
        callback.call( this, {
          result: false,
          error: "The DB is not opened"
        } );
      }

      return;
    }




    // ## Save internally

    // Searching for the collection
    var collectionToInsertOrUpdate = undefined;
    for( var i = 0; i < collections.length && collectionToInsertOrUpdate == undefined; i++ ) {
      if( collections[i].value == collectionName ) {
        collectionToInsertOrUpdate = collections[i];
      }
    }

    if( collectionToInsertOrUpdate == undefined ) {
      collectionToInsertOrUpdate = {
        value: collectionName,
        datas: []
      };

      collections.push( collectionToInsertOrUpdate );
    }

    // Add the entry
    if( Object.prototype.toString.call( entry )  == "[object Array]" ) {
      for( var i = 0; i < entry.length; i++ )
        collectionToInsertOrUpdate.datas.push( entry[i] );
    }
    else
      collectionToInsertOrUpdate.datas.push( entry );


    // ## Save to disk the DB
    saveDB( callback );
  };

  /**
   *
   * @param collectionName Name of the collection
   * @param newCollection Bunch of object for the collection
   * @param callback Callback for success or error
   */
  SimpleNoSQL.replaceCollection = function( collectionName, newCollection, callback ) {
    if( !isOpened ) {
      if( callback ) {
        callback.call( this, {
          result: false,
          error: "The DB is not opened"
        } );
      }

      return;
    }



    // ## Save internally

    // Searching for the collection
    var collectionToInsertOrUpdate;
    for( var i = 0; i < collections.length && collectionToInsertOrUpdate == undefined; i++ ) {
      if( collections[i].value == collectionName ) {
        collectionToInsertOrUpdate = collections[i];
      }
    }

    if( collectionToInsertOrUpdate == undefined ) {
      collectionToInsertOrUpdate = {
        value: collectionName,
        datas: newCollection
      };

      collections.push( collectionToInsertOrUpdate );
    }
    else {
      collectionToInsertOrUpdate.datas = newCollection;
    }


    // ## Save to disk the DB
    saveDB( callback );
  };

  /**
   *
   * @param collectionName Name of the collection
   * @param callback Callback for success or error
   */
  SimpleNoSQL.resetCollection = function( collectionName, callback ) {
    if( !isOpened ) {
      if( callback ) {
        callback.call( this, {
          result: false,
          error: "The DB is not opened"
        } );
      }

      return;
    }

    // ## Save internally

    // Searching for the collection
    var collectionFound = false;
    for( var i = 0; i < collections.length && !collectionFound; i++ ) {
      if( collections[i].value == collectionName ) {
        collections[i].datas = [];
        collectionFound = true;
      }
    }


    // ## Save to disk the DB
    saveDB( callback );
  };


  /**
   *
   * @param collectionName
   * @param entry
   * @param callback
   */
  SimpleNoSQL.removeEntry = function( collectionName, entry, callback ) {
    if( !isOpened ) {
      if( callback ) {
        callback.call( this, {
          result: false,
          error: "The DB is not opened"
        } );
      }

      return;
    }

    // ## Save internally
    var entryFound = false;
    for( var i = 0; i < collections.length && !entryFound; i++ ) {
      var collection = collections[i];

      if( collection.value == collectionName ) {
        var idx = collection.datas.indexOf( entry );

        if( idx > -1 ) {
          collection.datas.splice( idx, 1 );
          entryFound = true;
        }
      }
    }

    // ## Save to disk
    saveDB( callback );
  };

  SimpleNoSQL.updateEntry = function( collectionName, oldEntry, newEntry, callback ) {
    SimpleNoSQL.removeEntry(collectionName, oldEntry, function() {
      SimpleNoSQL.addEntry(collectionName, newEntry, callback );
    });
  };

  /**
   * Save the DB on disk
   *
   * @param callback The callback for success or error
   */
  var saveDB = SimpleNoSQL.save = function( callback ) {
    if( !isOpened ) {
      if( callback ) {
        callback.call( this, {
          result: false,
          error: "The DB is not opened"
        } );
      }

      return;
    }

    timeoutCallbacks.push( callback );
    if( saveTimeout ) {
      clearTimeout( saveTimeout );
    }

//        console.log("test");

//        saveTimeout = setTimeout( function() {
    var availability = SimpleNoSQL.getAvailability();

    if( availability.available ) {
      if( availability.storedAsFile ) {
        // Store datas to file
//                    console.log("Save datas");
        dbFile.createWriter(function(writer) {
          writer.onwriteend = function(evt) {

            while( timeoutCallbacks.length > 0 ) {
              var to = timeoutCallbacks.shift();

              to.call( this, {
                result: true
              } );
            }
          };

          if (collections != undefined && collections != null) {
            writer.write(JSON.stringify(collections));
          }
          else {
            writer.write("");
          }
        }, function(error) {
          console.log( JSON.stringify(error) );
        });
      }
      else {
        // Store to localStorage
        localStorage.setItem(savedPath, JSON.stringify(collections));

        while( timeoutCallbacks.length > 0 ) {
          var to = timeoutCallbacks.shift();

          to.call( this, {
            result: true
          } );
        }
      }
    }

    saveTimeout = undefined;

//        }, 1000 );
  }


  /**
   *
   * @param callback
   */
  SimpleNoSQL.close = function( callback ) {
    if( isOpened ) {
      collections = [];

      closeDB();

      if( callback ) {
        callback.call( this );
      }
    }
  }


}).call(this, SimpleNoSQL, window);