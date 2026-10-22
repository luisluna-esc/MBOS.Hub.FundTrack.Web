import { Injectable, inject, signal } from '@angular/core';
import { SelectOption } from '../../shared/components/select/select';
import { Church, District, Pastor, Region } from './catalog.models';
import { ChurchService, DistrictService, PastorService, RegionService } from './catalog.services';

type Kind = 'regions' | 'districts' | 'pastors' | 'churches';

// Catálogos completos para llenar selects (filtros y formularios). Cada uno se pide una sola vez
// y queda en memoria; las pantallas que lo modifican llaman a invalidate() para que se recargue.
@Injectable({ providedIn: 'root' })
export class CatalogLookups {
  private readonly regionService = inject(RegionService);
  private readonly districtService = inject(DistrictService);
  private readonly pastorService = inject(PastorService);
  private readonly churchService = inject(ChurchService);

  readonly regions = signal<Region[]>([]);
  readonly districts = signal<District[]>([]);
  readonly pastors = signal<Pastor[]>([]);
  /** Todas las iglesias, grupos y filiales (con su estado). */
  readonly churches = signal<Church[]>([]);

  private readonly pending = new Map<Kind, Promise<void>>();

  load(...kinds: Kind[]): Promise<void> {
    return Promise.all(kinds.map((kind) => this.loadOne(kind))).then(() => undefined);
  }

  invalidate(...kinds: Kind[]): void {
    kinds.forEach((kind) => this.pending.delete(kind));
  }

  regionOptions(): SelectOption[] {
    return this.regions().map((r) => ({ value: String(r.regionId), label: r.name }));
  }

  districtOptions(regionId?: string | null): SelectOption[] {
    return this.districts()
      .filter((d) => !regionId || String(d.regionId) === regionId)
      .map((d) => ({ value: String(d.districtId), label: d.name }));
  }

  pastorOptions(): SelectOption[] {
    return this.pastors().map((p) => ({ value: String(p.pastorId), label: p.fullName }));
  }

  private loadOne(kind: Kind): Promise<void> {
    let promise = this.pending.get(kind);
    if (!promise) {
      promise = this.fetch(kind).catch(() => {
        this.pending.delete(kind);
      });
      this.pending.set(kind, promise);
    }
    return promise;
  }

  private async fetch(kind: Kind): Promise<void> {
    switch (kind) {
      case 'regions':
        this.regions.set(await this.regionService.all());
        break;
      case 'districts':
        this.districts.set(await this.districtService.all());
        break;
      case 'pastors':
        this.pastors.set(await this.pastorService.all());
        break;
      case 'churches':
        this.churches.set(await this.churchService.all());
        break;
    }
  }
}
