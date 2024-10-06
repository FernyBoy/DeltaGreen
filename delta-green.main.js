// Definir el área de interés: Hermosillo, Sonora
var roi = ee.Geometry.Rectangle([-110.9, 29.0, -110.7, 29.2]);

// Cargar la colección de Landsat 8 (Temperatura de Superficie)
var landsat8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterDate('2020-09-01', '2020-09-30')  // Septiembre 2020
    .filterBounds(roi)
    .filter(ee.Filter.lt('CLOUD_COVER', 10))  // Filtrar imágenes con menos del 10% de nubosidad
    .select('ST_B10');  // Banda de Temperatura de Superficie

// Convertir la temperatura de la superficie de radiancia a Kelvin
var temperatureImageKelvin = landsat8.mean()
    .multiply(0.00341802)
    .add(149);

// Convertir Kelvin a Celsius
var temperatureImageCelsius = temperatureImageKelvin.subtract(273.15);

// Inspeccionar los valores de temperatura para entender el rango en Celsius
var stats = temperatureImageCelsius.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: roi,
    scale: 30,
    maxPixels: 1e9
});

// Función para actualizar el mapa de calor
function actualizarMapaDeCalor(geometry) {
    // Filtrar la colección de Landsat 8 para el área dibujada
    var landsat8Dibujado = landsat8.filterBounds(geometry);
    
    // Calcular la temperatura media en el área dibujada
    var temperatureImageKelvinDibujado = landsat8Dibujado.mean()
        .multiply(0.00341802)
        .add(149);
    var temperatureImageCelsiusDibujado = temperatureImageKelvinDibujado.subtract(273.15);
    
    // Reducir la temperatura en 5 grados Celsius
    var temperatureImageCelsiusReducida = temperatureImageCelsiusDibujado.subtract(10);
    
    // Calcular estadísticas de temperatura
    var statsDibujado = temperatureImageCelsiusReducida.reduceRegion({
        reducer: ee.Reducer.minMax(),
        geometry: geometry,
        scale: 30,
        maxPixels: 1e9
    });
    
    // Evaluar y actualizar el mapa
    statsDibujado.evaluate(function(result) {
        var minTemp = result['ST_B10_min'];
        var maxTemp = result['ST_B10_max'];
        var visParams = {
            min: minTemp,
            max: maxTemp,
            palette: ['#FFFF00', '#FFC000', '#FF7401', '#C00000', '#540000']
        };
        Map.layers().reset(); // Limpiar capas anteriores
        Map.addLayer(temperatureImageCelsiusReducida, visParams, 'Temperatura Reducida (°C)');
    });
}

// Evaluar estadísticas iniciales y configurar visualización
stats.evaluate(function(result) {
    print('Estadísticas de Temperatura en Celsius:', result);
    var minTemp = result['ST_B10_min'];
    var maxTemp = result['ST_B10_max'];
    print('Temperatura Mínima (°C):', minTemp);
    print('Temperatura Máxima (°C):', maxTemp);

    var visParams = {
        min: minTemp,
        max: maxTemp,
        palette: ['#FFFF00', '#FFC000', '#FF7401', '#C00000', '#540000']
    };

    Map.centerObject(roi, 12);
    var temperatureLayer = Map.addLayer(temperatureImageCelsius, visParams, 'Temperatura de Superficie (°C)');

    var legend = ui.Panel({ style: {position: 'bottom-left', padding: '8px'} });
    var legendTitle = ui.Label('Temperatura de Superficie (°C)', {fontWeight: 'bold'});
    legend.add(legendTitle);

    var palette = visParams.palette;
    var minLegend = minTemp;
    var maxLegend = maxTemp;
    var steps = 10;

    for (var i = 0; i <= steps; i++) {
        var value = minLegend + (maxLegend - minLegend) * (i / steps);
        var color = palette[Math.floor(i * (palette.length - 1) / steps)];
        var legendEntry = ui.Panel({
            widgets: [
                ui.Label(value.toFixed(1) + '°C'),
                ui.Label('', {backgroundColor: color, width: '20px', height: '20px'})
            ],
            layout: ui.Panel.Layout.Flow('horizontal')
        });
        legend.add(legendEntry);
    }

    var roiCentroid = roi.centroid().coordinates();
    roiCentroid.evaluate(function(coords) {
        var lon = -110.972471;
        var lat = 29.092477;
        Map.setCenter(lon, lat, 12);
    });

    Map.setOptions('ROADMAP');
    Map.setControlVisibility({
        zoomControl: true,
        scaleControl: true,
        fullscreenControl: false,
        mapTypeControl: false,
        layerList: true
    });

    var bounds = roi.bounds();
    Map.add(legend);

    var opacitySlider = ui.Slider({
        min: 0,
        max: 1,
        step: 0.01,
        value: 0.5,
        onChange: function(value) {
            temperatureLayer.setOpacity(value);
        },
        style: {width: '200px'}
    });

    var opacityLabel = ui.Label('Ajustar Opacidad:');
    panel.add(opacityLabel);
    panel.add(opacitySlider);
});

// Definir un punto en Hermosillo
var hermosillo = ee.Geometry.Point([-110.9613, 29.0729]);

// Crear un panel para contener los botones
var panel = ui.Panel();
panel.style().set({ width: '250px', height: '300px', position: 'top-right' });
Map.add(panel);

var boton = ui.Button({
    label: 'Centrar mapa',
    style: { color: 'black', backgroundColor: 'blue' },
    onClick: function() { Map.centerObject(hermosillo, 15); }
});
panel.add(boton);

var botonDibujar = ui.Button({
    label: 'Dibujar área en el mapa',
    style: { color: 'black', backgroundColor: 'green' },
    onClick: function() {
        Map.drawingTools().setShown(true);
        Map.drawingTools().setShape('polygon');
        Map.drawingTools().draw();
        Map.drawingTools().onDraw(function(geometry, layer) {
            layer.setColor('#37FD12');
        });
    }
});
panel.add(botonDibujar);

var botonFinalizar = ui.Button({
    label: 'Finalizar dibujo y actualizar mapa',
    style: { color: 'black', backgroundColor: 'red' },
    onClick: function() {
        var geometria = Map.drawingTools().layers().get(0).getEeObject();
        print('Geometría dibujada:', geometria);
        Map.drawingTools().setShape(null);
        Map.drawingTools().setShown(false);
        actualizarMapaDeCalor(geometria);
    }
});
panel.add(botonFinalizar);

var botonEliminar = ui.Button({
    label: 'Eliminar polígonos',
    style: { color: 'black', backgroundColor: 'red' },
    onClick: function() {
        Map.drawingTools().layers().forEach(function(layer) {
            Map.drawingTools().layers().remove(layer);
        });
        print('Se han eliminado todos los polígonos dibujados.');
        actualizarMapaDeCalor(roi);
    }
});
panel.add(botonEliminar);

Map.drawingTools().setShown(false);