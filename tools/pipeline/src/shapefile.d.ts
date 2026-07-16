declare module 'shapefile' {
  interface Source {
    read(): Promise<{ done: boolean; value: GeoJSON.Feature }>;
  }
  export function open(shp: string, dbf?: string, options?: { encoding?: string }): Promise<Source>;
}
