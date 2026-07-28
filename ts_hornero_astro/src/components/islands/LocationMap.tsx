import LeafletMap from './leaflet-map';

interface LocationMapProps {
  lat: number;
  lng: number;
  label?: string;
  height?: number | string;
}

export default function LocationMap({ lat, lng, label, height = 150 }: LocationMapProps) {
  return (
    <LeafletMap
      markers={[{ id: 'org', lat, lng, active: true, label }]}
      center={{ lat, lng }}
      zoom={15}
      height={height}
      interactive={false}
    />
  );
}
