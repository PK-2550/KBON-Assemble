import React from 'react';
import { UserRole, DurianFarm } from '../types';

interface FarmUpgradeBannerProps {
  currentRole: UserRole;
  onOpenRegisterModal: () => void;
  onOpenAdminApprovalModal: () => void;
  onSelectManagedFarm?: (farmId: string) => void;
  farms: DurianFarm[];
}

export const FarmUpgradeBanner: React.FC<FarmUpgradeBannerProps> = () => {
  return null;
};
