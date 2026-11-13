import type { CatalogItem, Party } from '../../domain/invoice';
import { centsToInput } from '../../domain/money';
import { IconPlus, IconTrash } from './Icons';

interface SavedRecordsProps {
  customers: Party[];
  items: CatalogItem[];
  onNewInvoice: (customer: Party) => void;
  onDeleteCustomer: (customer: Party) => void;
  onDeleteItem: (item: CatalogItem) => void;
}

/** The customers and items remembered from saved invoices, with a way to remove them. */
export function SavedRecords({ customers, items, onNewInvoice, onDeleteCustomer, onDeleteItem }: SavedRecordsProps) {
  return (
    <>
      <section className="card saved" aria-labelledby="saved-customers">
        <h2 className="card__title" id="saved-customers">
          Uložení odběratelé
        </h2>
        {customers.length === 0 ? (
          <p className="field__hint">Odběratel se uloží sám, když uložíš fakturu.</p>
        ) : (
          <ul className="saved__list">
            {customers.map((customer) => (
              <li key={`${customer.ico}-${customer.name}`} className="saved__row">
                <div className="saved__text">
                  <strong>{customer.name}</strong>
                  <span>{[customer.ico && `IČO ${customer.ico}`, customer.city].filter(Boolean).join(' · ')}</span>
                </div>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => onNewInvoice(customer)}>
                  <IconPlus size={16} />
                  Nová faktura
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Smazat odběratele ${customer.name}`}
                  title="Smazat"
                  onClick={() => onDeleteCustomer(customer)}
                >
                  <IconTrash />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card saved" aria-labelledby="saved-items">
        <h2 className="card__title" id="saved-items">
          Uložené položky
        </h2>
        {items.length === 0 ? (
          <p className="field__hint">Položky se uloží samy, když uložíš fakturu. V editoru je pak nabídne popis.</p>
        ) : (
          <ul className="saved__list">
            {items.map((item) => (
              <li key={item.description} className="saved__row">
                <div className="saved__text">
                  <strong>{item.description}</strong>
                  <span>
                    {centsToInput(item.unitPriceCents)} Kč / {item.unit || 'ks'}
                    {item.vatRate ? ` · DPH ${item.vatRate} %` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Smazat položku ${item.description}`}
                  title="Smazat"
                  onClick={() => onDeleteItem(item)}
                >
                  <IconTrash />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
