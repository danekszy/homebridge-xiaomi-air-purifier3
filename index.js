'use strict';
// https://github.com/aschzero/homebridge-airmega/blob/master/lib/services/PurifierService.ts
// http://miot-spec.org/miot-spec-v2/instance?type=urn:miot-spec-v2:device:air-purifier:0000A007:zhimi-ma4:1
// https://github.com/Colorado4Wheeler/HomeKit-Bridge/wiki/HomeKit-Model-Reference

var Service, Characteristic;
var MIoTAirPurifier = require('./MIoTAirPurifier');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-xiaomi-air-purifier3", "XiaomiAirPurifier3", XiaomiAirPurifier3);
}

function XiaomiAirPurifier3(log, config) {
    var that = this;
    this.log = log;
    this.services = [];

    this.miotPurifier = new MIoTAirPurifier(config['did'], config['token'], config['ip']);

    this.miotPurifier.onChange('power', value => {
        that.updateActive();
        that.updateStatusActive();
        that.updateCurrentAirPurifierState();
    });

    this.miotPurifier.onChange('mode', value => { 
        that.updateTargetAirPurifierState();
    });

    this.miotPurifier.onChange('speed_read', value => {
        that.updateRotationSpeed();
        that.updateCurrentAirPurifierState();
    });

    this.miotPurifier.onChange('lock', value => {
        that.updateLockPhysicalControls();
    });

    this.miotPurifier.onChange('filter_level', value => {
        that.updateFilterChangeIndication();
        that.updateFilterLifeLevel();
    });

    this.miotPurifier.onChange('pm25', value => {
        that.updateAirQuality();
        that.updatePM2_5Density();
    });

    setInterval(function() {
        that.log('Polling properties')
        that.miotPurifier.pollProperties();
    }, 30000);
}

XiaomiAirPurifier3.prototype.getServices = function() {
    // Accessory Information Service
    this.informationService = new Service.AccessoryInformation();

    this.informationService
          .setCharacteristic(Characteristic.Name        , this.name)
          .setCharacteristic(Characteristic.Manufacturer, 'Xiaomi')
          .setCharacteristic(Characteristic.Model       , 'Mi Air Purifier 3/3H')

    // Air Purifier Service
    this.airPurifierService = new Service.AirPurifier(this.name);

    this.airPurifierService
        .getCharacteristic(Characteristic.Active)
        .on('get', this.getActive.bind(this))
        .on('set', this.setActive.bind(this));
    this.airPurifierService
        .getCharacteristic(Characteristic.CurrentAirPurifierState)
        .on('get', this.getCurrentAirPurifierState.bind(this));
    this.airPurifierService
        .getCharacteristic(Characteristic.TargetAirPurifierState)
        .on('get', this.getTargetAirPurifierState.bind(this))
        .on('set', this.setTargetAirPurifierState.bind(this));
    this.airPurifierService
        .getCharacteristic(Characteristic.RotationSpeed)
        .on('get', this.getRotationSpeed.bind(this))
        .on('set', this.setRotationSpeed.bind(this));
    this.airPurifierService
        .getCharacteristic(Characteristic.LockPhysicalControls)
        .on('get', this.getLockPhysicalControls.bind(this))
        .on('set', this.setLockPhysicalControls.bind(this));

    // Filter Service
    this.filterService = new Service.FilterMaintenance(this.name);

    this.filterService.
        getCharacteristic(Characteristic.FilterChangeIndication)
        .on('get', this.getFilterChangeIndication.bind(this));
    this.filterService.
        getCharacteristic(Characteristic.FilterLifeLevel)
        .on('get', this.getFilterLifeLevel.bind(this));

    //Air Quality Sensor
    this.airQualitySensorService = new Service.AirQualitySensor(this.name);

    this.airQualitySensorService
        .getCharacteristic(Characteristic.StatusActive)
        .on('get', this.getStatusActive.bind(this));
    this.airQualitySensorService
        .getCharacteristic(Characteristic.AirQuality)
        .on('get', this.getAirQuality.bind(this));
    this.airQualitySensorService
        .getCharacteristic(Characteristic.PM2_5Density)
        .on('get', this.getPM2_5Density.bind(this));

    this.services.push(this.informationService);
    this.services.push(this.airPurifierService);
    this.services.push(this.filterService);
    this.services.push(this.airQualitySensorService);
    

    return this.services;
}

XiaomiAirPurifier3.prototype.getActive = function(callback) {
    this.log('getActive');

    try {
        if (this.miotPurifier.get('power') == true) {
            return callback(null, Characteristic.Active.ACTIVE);
        } else {
            return callback(null, Characteristic.Active.INACTIVE);
        }
    } catch (e) {
        this.log('getActive Failed: ' + e);
        callback(e);
    }
}

XiaomiAirPurifier3.prototype.setActive = function(targetState, callback, context) {
    this.log('setActive ' + targetState + ' ' + context);

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {
        if (targetState == Characteristic.Active.ACTIVE) {
            this.miotPurifier.set('power', true);
        } else {
            this.miotPurifier.set('power', false);
        }

        callback();
    } catch (e) {
        this.log('setActive Failed: ' + e);
        callback(e);
    }
}

XiaomiAirPurifier3.prototype.updateActive = function() {
    this.log('updateActive');

    try {
        var targetValue = this.miotPurifier.get('power') ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;

        this.airPurifierService
            .getCharacteristic(Characteristic.Active)
            .setValue(targetValue, undefined, 'fromOutsideHomekit');

    }  catch (e) {
        this.log('updateActive Failed: ' + e);
    }
}

XiaomiAirPurifier3.prototype.getCurrentAirPurifierState = function(callback) {
    this.log('getCurrentAirPurifierState');

    try {
        var value = Characteristic.CurrentAirPurifierState.INACTIVE;

        if (this.miotPurifier.get('power') == true) {
            if (this.miotPurifier.getSpeed() == 0) {
                value = Characteristic.CurrentAirPurifierState.IDLE;
            } else {
                value = Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
            }
        }

        callback(null, value);
    } catch(e) {
        this.log('getCurrentAirPurifierState Failed: ' + e);
        callback(e);
    }
}

XiaomiAirPurifier3.prototype.updateCurrentAirPurifierState = function(callback) {
    this.log('updateCurrentAirPurifierState');

    try {
        var value = Characteristic.CurrentAirPurifierState.INACTIVE;

        if (this.miotPurifier.get('power') == true) {
            if (this.miotPurifier.getSpeed() == 0) {
                value = Characteristic.CurrentAirPurifierState.IDLE;
            } else {
                value = Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
            }
        }

        this.airPurifierService.setCharacteristic(Characteristic.CurrentAirPurifierState, value);

    } catch (e) {
        this.log('updateCurrentAirPurifierState Failed: ' + e);
    }
}

XiaomiAirPurifier3.prototype.getTargetAirPurifierState = function(callback) {
    this.log('getTargetAirPurifierState' );

    try {
        if (this.miotPurifier.get('mode') == 0) {
            callback(null, Characteristic.TargetAirPurifierState.AUTO);
        } else {
            callback(null, Characteristic.TargetAirPurifierState.MANUAL);
        }
    } catch(e) {
        this.log('getTargetAirPurifierState Failed: ' + e);
        callback(e);
    }
}

XiaomiAirPurifier3.prototype.setTargetAirPurifierState = function(targetState, callback, context) {
    this.log('setTargetAirPurifierState ' + targetState + ' ' + context );

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {
        if (targetState ==  Characteristic.TargetAirPurifierState.AUTO) {
            this.miotPurifier.set('mode', 0);
        } else {
            if (this.miotPurifier.get('mode') == 0) {
                this.miotPurifier.set('mode', 2);
            }
        }

        callback();
    } catch(e) {
        this.log('setTargetAirPurifierState Failed: ' + e) ;
        callback(e);
    }
}

XiaomiAirPurifier3.prototype.updateTargetAirPurifierState = function() {
    this.log('updateTargetAirPurifierState');

    try {
        var targetValue = this.miotPurifier.get('mode') == 0 ? Characteristic.TargetAirPurifierState.AUTO : Characteristic.TargetAirPurifierState.MANUAL;

        this.airPurifierService
            .getCharacteristic(Characteristic.TargetAirPurifierState)
            .setValue(targetValue, undefined, 'fromOutsideHomekit');
    } catch (e) {
        this.log('updateTargetAirPurifierState Failed: ' + e) ;  
    }
}

XiaomiAirPurifier3.prototype.getRotationSpeed = function(callback) {
    this.log('getRotationSpeed');

    try {
        callback(null, this.miotPurifier.getSpeed());
    } catch(e) {
        this.log('getRotationSpeed Failed: ' + e);
        callback(e);
    }
}

XiaomiAirPurifier3.prototype.setRotationSpeed = function(targetSpeed, callback, context) {
    this.log('setRotationSpeed ' + targetSpeed + " " + context);

    if (context === 'fromOutsideHomekit') { return callback(null) }

    try {
        this.miotPurifier.setSpeed(targetSpeed);

        if (this.miotPurifier.get('mode') == 0) {
            this.miotPurifier.set('mode', 2);
        }

        callback(null);
    } catch (e) {
        this.log('setRotationSpeed Failed : ' + e);
        callback(e);
    }
}

XiaomiAirPurifier3.prototype.updateRotationSpeed = function() {
    this.log('updateRotationSpeed');

    try {
        var speed = this.miotPurifier.getSpeed();

        this.airPurifierService
            .getCharacteristic(Characteristic.RotationSpeed)
            .setValue(speed, undefined, 'fromOutsideHomekit');
    } catch (e) {
        this.log('updateRotationSpeed Failed : ' + e);
    }
}

XiaomiAirPurifier3.prototype.getLockPhysicalControls = function(callback) {
    this.log('getLockPhysicalControls');

    try {
        if (this.miotPurifier.get('lock') == true) {
            return callback(null, Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED);
        } else {
            return callback(null, Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED);
        }
    } catch(e) {
        this.log('getLockPhysicalControls Failed: ' + e);
        callback(e);
    }
}

XiaomiAirPurifier3.prototype.setLockPhysicalControls = function(targetState, callback, context) {
    this.log('setLockPhysicalControls ' + targetState + ' ' + context);

    if (context === 'fromOutsideHomekit') { return callback(); }

    try {
        if (targetState == Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED) {
            this.miotPurifier.set('lock', true);
        } else {
            this.miotPurifier.set('lock', false);
        }

        callback();
    } catch (e) {
        this.log('setLockPhysicalControls Failed: ' + e);
        callback(e);
    }
}

XiaomiAirPurifier3.prototype.updateLockPhysicalControls = function() {
    this.log('updateLockPhysicalControls');

    try {

        var targetValue = this.miotPurifier.get('lock') ? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED : Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;

        this.airPurifierService
            .getCharacteristic(Characteristic.LockPhysicalControls)
            .setValue(targetValue, undefined, 'fromOutsideHomekit');
    } catch(e) {
        this.log('updateLockPhysicalControls Failed: ' + e);
    }
}

XiaomiAirPurifier3.prototype.getFilterChangeIndication = function(callback) {
    this.log('getFilterChangeIndication');

    try {
        if (this.miotPurifier.get('filter_level') <= 15) {
            return callback(null, Characteristic.FilterChangeIndication.CHANGE_FILTER);    
        } else {
            return callback(null, Characteristic.FilterChangeIndication.FILTER_OK);
        }
        
    } catch (e) {
        this.log('getFilterChangeIndication Failed: ' + e);
        callback(e);
    }
}

XiaomiAirPurifier3.prototype.updateFilterChangeIndication = function() {
    this.log('updateFilterChangeIndication');

    try {
        if (this.miotPurifier.get('filter_level') <= 15) {
            this.filterService.setCharacteristic(Characteristic.FilterChangeIndication, Characteristic.FilterChangeIndication.CHANGE_FILTER);
        } else {
            this.filterService.setCharacteristic(Characteristic.FilterChangeIndication, Characteristic.FilterChangeIndication.FILTER_OK);
        }
    } catch(e) {
        this.log('updateFilterChangeIndication Failed: ' + e);
    }
}

XiaomiAirPurifier3.prototype.getFilterLifeLevel = function(callback) {
    this.log('getFilterLifeLevel');

    try {
        return callback(null, this.miotPurifier.get('filter_level'));
    } catch(e) {
        this.log('getFilterLifeLevel Failed: ' + e);
        callback(e);
    }
}

XiaomiAirPurifier3.prototype.updateFilterLifeLevel = function() {
    this.log("updateFilterLifeLevel");

    try {
        this.filterService.setCharacteristic(Characteristic.FilterLifeLevel, this.miotPurifier.get('filter_level'));
    } catch(e) {
        this.log('updateFilterLifeLevel Failed: ' + e);
    }
}

XiaomiAirPurifier3.prototype.getStatusActive = function(callback) {
    this.log('getStatusActive');

    try {
        if (this.miotPurifier.get('power') == true) {
            return callback(null, true);
        } else {
            return callback(null, false);
        }
    } catch (e) {
        this.log('getStatusActive Failed: ' + e);
        callback(e);
    }
}

XiaomiAirPurifier3.prototype.updateStatusActive = function() {
    this.log('updateStatusActive');

    try {
        if (this.miotPurifier.get('power') == true) {
            this.airQualitySensorService.setCharacteristic(Characteristic.StatusActive, true);
        } else {
            this.airQualitySensorService.setCharacteristic(Characteristic.StatusActive, false);
        }
    }  catch (e) {
        this.log('updateStatusActive Failed: ' + e);
    }
}

XiaomiAirPurifier3.prototype.getAirQuality = function(callback) {
    this.log("getAirQuality");

    try {
        var pm25    = this.miotPurifier.get('pm25');
        var quality = Characteristic.AirQuality.UNKNOWN;

        if      (pm25 <=  35) { quality = Characteristic.AirQuality.EXCELLENT; }
        else if (pm25 <=  75) { quality = Characteristic.AirQuality.GOOD;      }
        else if (pm25 <= 115) { quality = Characteristic.AirQuality.FAIR;      }
        else if (pm25 <= 150) { quality = Characteristic.AirQuality.INFERIOR;  }
        else if (pm25 <= 250) { quality = Characteristic.AirQuality.POOR;      }
        else                  { quality = Characteristic.AirQuality.POOR;      }

        return callback(null, quality);
    } catch(e) {
        this.log('getAirQuality Failed: ' + e);
        callback(e);
    }
}

XiaomiAirPurifier3.prototype.updateAirQuality = function() {
    this.log("updateAirQuality");

    try {
        var pm25    = this.miotPurifier.get('pm25');
        var quality = Characteristic.AirQuality.UNKNOWN;

        if      (pm25 <=  35) { quality = Characteristic.AirQuality.EXCELLENT; }
        else if (pm25 <=  75) { quality = Characteristic.AirQuality.GOOD;      }
        else if (pm25 <= 115) { quality = Characteristic.AirQuality.FAIR;      }
        else if (pm25 <= 150) { quality = Characteristic.AirQuality.INFERIOR;  }
        else if (pm25 <= 250) { quality = Characteristic.AirQuality.POOR;      }
        else                  { quality = Characteristic.AirQuality.POOR;      }

        this.airQualitySensorService.setCharacteristic(Characteristic.AirQuality, quality);
    } catch(e) {
        this.log('updateAirQuality Failed: ' + e);
    }   
}

XiaomiAirPurifier3.prototype.getPM2_5Density = function(callback) {
    this.log("getPM2_5Density");

    try {
        return callback(null, this.miotPurifier.get('pm25'));
    } catch(e) {
        this.log('getAirQuality Failed: ' + e);
        callback(e);
    }
}

XiaomiAirPurifier3.prototype.updatePM2_5Density = function() {
    this.log('updatePM2_5Density');

    try {
        this.airQualitySensorService.setCharacteristic(Characteristic.PM2_5Density, this.miotPurifier.get('pm25'));
    }  catch (e) {
        this.log('updatePM2_5Density Failed: ' + e);
    }
}



