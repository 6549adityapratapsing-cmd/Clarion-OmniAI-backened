import { Request, Response } from 'express';
import { dataStore } from '../repositories/dataStore';

export const listSuppliers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const suppliers = Array.from(dataStore.suppliers.values());
    res.json({
      success: true,
      data: { suppliers }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_SUPPLIERS_FAILED', message: err.message }
    });
  }
};

export const getSupplierById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const supplier = dataStore.suppliers.get(id);

    if (!supplier) {
      res.status(404).json({
        success: false,
        error: { code: 'SUPPLIER_NOT_FOUND', message: 'Supplier profile not found.' }
      });
      return;
    }

    // Get related documents
    const relatedDocs = Array.from(dataStore.documents.values()).filter(
      (d) => d.supplierId === id || (d.supplierName && d.supplierName.toLowerCase() === supplier.name.toLowerCase())
    );

    res.json({
      success: true,
      data: {
        supplier,
        documents: relatedDocs
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_SUPPLIER_FAILED', message: err.message }
    });
  }
};
