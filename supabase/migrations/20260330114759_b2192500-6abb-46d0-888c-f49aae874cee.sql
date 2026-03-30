-- Fix Solana master wallet indexes: 9HyPB7 = PRIMARY (index 0)
UPDATE admin_wallets SET wallet_index = 0 WHERE id = '218ae3d4-bd7c-404a-9c9d-127bbdbaf529';
UPDATE admin_wallets SET wallet_index = 1 WHERE id = '71e79e59-ee98-4921-a44a-c5c723612571';
UPDATE admin_wallets SET wallet_index = 2 WHERE id = 'd2fb114a-5c34-4f0b-9280-01f6c3f6ec33';
UPDATE admin_wallets SET wallet_index = 3 WHERE id = '9d20fda3-51d3-4927-b94d-6a90ee257bdc';
UPDATE admin_wallets SET wallet_index = 4 WHERE id = 'a1bf10b7-b612-4913-8ca2-5ba5551cef27';
UPDATE admin_wallets SET wallet_index = 5 WHERE id = 'aad43853-74fc-4517-a84d-00445ba9571d';