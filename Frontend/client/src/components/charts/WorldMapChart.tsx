import { memo, useEffect } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface WorldMapChartProps {
  miningLocations: any[]; 
}

const WorldMapChart = ({ miningLocations }: WorldMapChartProps) => {
  useEffect(() => {
    // Fix for CSS resources in SSR/development
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: null,
      iconUrl: null,
      shadowUrl: null,
    });
  }, []);

  return (
    <div className="w-full h-full relative bg-card/95 rounded-lg overflow-hidden">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ height: "100%", width: "100%" }}
        className="z-0 [&_.leaflet-tile-pane]:brightness-[1.5] [&_.leaflet-tile-pane]:contrast-[1.2] [&_.leaflet-tile-pane]:saturate-[0.3]"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
      </MapContainer>
    </div>
  );
};

export default memo(WorldMapChart);