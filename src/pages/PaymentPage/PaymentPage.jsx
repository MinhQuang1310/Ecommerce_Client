import { Form, Radio } from 'antd';
import React, { useState, useEffect, useMemo } from 'react';
import { Lable, WrapperInfo, WrapperLeft, WrapperRadio, WrapperRight, WrapperTotal } from './style';
import ButtonComponent from '../../components/ButtonComponent/ButtonComponent';
import { useDispatch, useSelector } from 'react-redux';
import { convertPrice } from '../../utils';
import ModalComponent from '../../components/ModalComponent/ModalComponent';
import InputComponent from '../../components/InputComponent/InputComponent';
import { useMutationHooks } from '../../hooks/useMutationHook';
import * as UserService from '../../services/UserService';
import * as OrderService from '../../services/OrderService';
import Loading from '../../components/LoadingComponent/Loading';
import * as message from '../../components/Message/Message';
import { updateUser } from '../../redux/slides/userSlide';
import { useNavigate } from 'react-router-dom';
import { removeAllOrderProduct } from '../../redux/slides/orderSlide';
import { PayPalButton } from "react-paypal-button-v2";
import * as PaymentService from '../../services/PaymentService';
// In PaymentPage.jsx



const PaymentPage = () => {
  const order = useSelector((state) => state.order);
  const user = useSelector((state) => state.user);

  const [delivery, setDelivery] = useState('fast');
  const [payment, setPayment] = useState('later_money');
  const navigate = useNavigate();
  const [sdkReady, setSdkReady] = useState(false);

  const [isOpenModalUpdateInfo, setIsOpenModalUpdateInfo] = useState(false);
  const [stateUserDetails, setStateUserDetails] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
  });
  const [form] = Form.useForm();

  const dispatch = useDispatch();

  useEffect(() => {
    form.setFieldsValue(stateUserDetails);
  }, [form, stateUserDetails]);

  useEffect(() => {
    if (isOpenModalUpdateInfo) {
      setStateUserDetails({ ...user }); // Update only on modal open or user data change
    }
  }, [isOpenModalUpdateInfo, user]);

  const handleChangeAddress = () => {
    setIsOpenModalUpdateInfo(true);
  };

  // Calculate price considering potential infinite loop fix
  const priceMemo = useMemo(() => {
    if (!order?.orderItemsSlected) {
      return 0; // Handle potential empty order scenario
    }

    return order.orderItemsSlected.reduce((total, cur) => {
      return total + (cur.price * cur.amount);
    }, 0);
  }, [order]);

  const priceDiscountMemo = useMemo(() => {
    if (!order?.orderItemsSlected) {
      return 0; // Handle potential empty order scenario
    }

    return order.orderItemsSlected.reduce((total, cur) => {
      const totalDiscount = cur.discount ? cur.discount : 0;
      return total + (priceMemo * (totalDiscount * cur.amount) / 100);
    }, 0);
  }, [order, priceMemo]);

  const diliveryPriceMemo = useMemo(() => {
    if (priceMemo > 200000) {
      return 10000;
    } else if (priceMemo === 0) {
      return 0;
    } else {
      return 20000;
    }
  }, [priceMemo]);

  const totalPriceMemo = useMemo(() => {
    return Number(priceMemo) - Number(priceDiscountMemo) + Number(diliveryPriceMemo);
  }, [priceMemo, priceDiscountMemo, diliveryPriceMemo]);

    // ... existing code

    const handleAddOrder = async () => {
      if (user?.access_token && order?.orderItemsSlected && user?.name
        && user?.address && user?.phone && user?.city && priceMemo && user?.id) {
        try {
          const response = await OrderService.createOrder({
            token: user?.access_token,
            orderItems: order?.orderItemsSlected,
            fullName: user?.name,
            address: user?.address,
            phone: user?.phone,
            city: user?.city,
            paymentMethod: payment,
            itemsPrice: priceMemo,
            deliveryPrice: diliveryPriceMemo,
            totalPrice: totalPriceMemo,
          });
  
          if (response.status === 200) {
            dispatch(removeAllOrderProduct());
            navigate('/success'); // Redirect upon successful order creation
            message.success('Your order has been placed successfully!');
          } else {
            message.error('An error occurred while placing your order. Please try again.');
          }
        } catch (error) {
          console.error('Error adding order:', error);
          message.error('An error occurred while placing your order. Please try again.');
        }
      } else {
        message.error('Please fill in all required information and select a payment method.');
      }
    };
  
    const handleSuccessPaymentPayPal = async (details) => {
      const paymentData = {
        orderId: details.orderID,
        payerID: details.payerID,
        paymentToken: details.paymentToken,
        paymentDetails: details.paymentDetails,
      };
  
      try {
        const response = await PaymentService.getConfig({
          token: user?.access_token,
          paymentData,
        });
  
        if (response.status === 200) {
          dispatch(removeAllOrderProduct());
          navigate('/success');
          message.success('Your order has been placed successfully!');
        } else {
          message.error('An error occurred while processing your PayPal payment. Please try again.');
        }
      } catch (error) {
        console.error('Error completing PayPal payment:', error);
        message.error('An error occurred while processing your PayPal payment. Please try again.');
      }
    };
  
    const content = (
      <>
        <WrapperInfo>
          <WrapperLeft>
            <Lable>Delivery:</Lable>
            <WrapperRadio>
              <Radio.Group value={delivery} onChange={(e) => setDelivery(e.target.value)}>
                <Radio.Button value="fast">Fast (2-3 days) - {convertPrice(20000)}</Radio.Button>
                <Radio.Button value="normal">Normal (5-7 days) - FREE</Radio.Button>
              </Radio.Group>
            </WrapperRadio>
          </WrapperLeft>
          <WrapperRight>
            <Lable>Payment:</Lable>
            <WrapperRadio>
              <Radio.Group value={payment} onChange={(e) => setPayment(e.target.value)}>
                <Radio.Button value="later_money">Cash on Delivery</Radio.Button>
                { /* Only render PayPal button if integration is complete */}
                {sdkReady && (
                  <Radio.Button value="paypal">PayPal</Radio.Button>
                )}
              </Radio.Group>
            </WrapperRadio>
          </WrapperRight>
        </WrapperInfo>
        <WrapperTotal>
          <Lable>Total:</Lable>
          <span>{convertPrice(totalPriceMemo)}</span>
        </WrapperTotal>
        {payment === 'paypal' && (
          <PayPalButton
            env="sandbox" // Change to 'production' for live environment
            clientAck="true" // Enable debug mode
            options={{
              headers: {
                'X-Client-Transaction-Id': Math.floor(Math.random() * 1e18).toString(16),
              },
            }}
            onSuccess={(details) => handleSuccessPaymentPayPal(details)}
          />
        )}
        <ButtonComponent text="Place Order" disabled={!totalPriceMemo} onClick={handleAddOrder} />
      </>
    );
  
      // ... existing code

  return (
    <div>
      {/* ... other content of the page */}
      {isOpenModalUpdateInfo && (
        <ModalComponent
          title="Update Your Information"
          visible={isOpenModalUpdateInfo}
          onClose={() => setIsOpenModalUpdateInfo(false)}
          footer={[
            <ButtonComponent text="Cancel" onClick={() => setIsOpenModalUpdateInfo(false)} />,
            <ButtonComponent text="Save" type="primary" form="updateUserInfoForm" htmlType="submit" />,
          ]}
        >
          <Form id="updateUserInfoForm" onFinish={async (formData) => {
            try {
              const response = await UserService.updateUser({
                token: user?.access_token,
                data: {
                  name: formData.name,
                  phone: formData.phone,
                  address: formData.address,
                  city: formData.city,
                },
              });

              if (response.status === 200) {
                setStateUserDetails(formData); // Update state after successful update
                dispatch(updateUser(formData)); // Update user data in redux store
                message.success('Your information has been updated successfully!');
                setIsOpenModalUpdateInfo(false);
              } else {
                message.error('An error occurred while updating your information. Please try again.');
              }
            } catch (error) {
              console.error('Error updating user:', error);
              message.error('An error occurred while updating your information. Please try again.');
            }
          }}>
            <InputComponent label="Name" name="name" initialValue={stateUserDetails.name} required />
            <InputComponent label="Phone Number" name="phone" initialValue={stateUserDetails.phone} required />
            <InputComponent label="Address" name="address" initialValue={stateUserDetails.address} required />
            <InputComponent label="City" name="city" initialValue={stateUserDetails.city} required />
          </Form>
        </ModalComponent>
      )}
      {content}
    </div>
  );
};

export default PaymentPage;
